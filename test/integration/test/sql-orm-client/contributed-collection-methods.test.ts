/**
 * Does the collection method the Postgres target contributes for a full-text
 * index find the right rows, in relevance order, and let Postgres use the
 * index? `db.Document.using.documents_search(q)` is called on the root
 * collection, after other methods, inside an include refinement, on `this` in
 * a custom collection class, inside `with` and inside a fragment for one model.
 *
 * The index is created from the DDL the migration planner renders for the
 * fixture contract. `EXPLAIN (FORMAT JSON)` on the SQL the ORM sends has to
 * name it, with sequential scans disabled.
 */
import { Collection, orm } from '@internal/sql-orm-client';
import type { SqlQueryPlan } from '@internal/sql-relational-core/plan';
import { websearchToTsquery } from '@internal/target-postgres/full-text';
import { blindCast } from '@internal/utils/casts';
import { beforeAll, describe, expect, it } from 'vitest';
import type { Contract } from '../sql-builder/fixtures/generated/contract';
import { type PlannedIndex, plannedExpressionIndexes } from '../sql-builder/full-text-index-ddl';
import { setupIntegrationTest, timeouts } from '../sql-builder/setup';

const QUERY = 'zebra';

/** Every `Index Name` anywhere in an EXPLAIN plan tree. */
function indexNames(node: unknown): readonly string[] {
  if (Array.isArray(node)) return node.flatMap(indexNames);
  if (node === null || typeof node !== 'object') return [];
  const record: Record<string, unknown> = { ...node };
  const own = typeof record['Index Name'] === 'string' ? [record['Index Name']] : [];
  return [...own, ...Object.values(record).flatMap(indexNames)];
}

class DocumentCollection extends Collection<Contract, 'Document'> {
  search(query: string) {
    return this.using.documents_search(websearchToTsquery(query));
  }
}

describe('the contributed full-text collection method', {
  timeout: timeouts.databaseOperation,
}, () => {
  const { runtime, client, contract, context, lower } = setupIntegrationTest();

  let searchIndex: PlannedIndex;

  beforeAll(async () => {
    const [index] = await plannedExpressionIndexes(contract(), 'documents');
    if (index === undefined) throw new Error('the documents table declares no index');
    searchIndex = index;
    await client().query(searchIndex.createSql);

    await client().query(`
      INSERT INTO documents (id, title, subtitle, body, parent_id)
      SELECT n,
             CASE WHEN n % 97 = 0 THEN 'zebra crossing' ELSE 'ordinary title ' || n END,
             CASE WHEN n % 2 = 0 THEN 'subtitle ' || n ELSE NULL END,
             CASE WHEN n % 89 = 0 THEN 'a zebra grazes here' WHEN n % 3 = 0 THEN NULL ELSE 'filler body ' || n END,
             CASE WHEN n > 300 THEN n - 300 ELSE NULL END
      FROM generate_series(1, 600) AS n
    `);
    await client().query('ANALYZE documents');
    await client().query('SET enable_seqscan = off');
  }, timeouts.spinUpPpgDev);

  function ormClient() {
    const captured: SqlQueryPlan<unknown>[] = [];
    const real = runtime();
    const recording = blindCast<
      typeof real,
      'a recording proxy over the suite runtime; the client only queries through it'
    >({
      ...real,
      query: ((plan: SqlQueryPlan<unknown>, options?: Parameters<typeof real.query>[1]) => {
        captured.push(plan);
        return real.query(plan, options);
      }) satisfies (...args: never[]) => unknown,
    });
    const client = orm({
      runtime: recording,
      context: context(),
      collections: { Document: DocumentCollection },
    });
    return { db: client.public, captured };
  }

  async function explainedIndexes(plan: SqlQueryPlan<unknown> | undefined) {
    if (plan === undefined) throw new Error('the query sent no plan');
    const lowered = lower(plan);
    const result = await client().query(`EXPLAIN (FORMAT JSON) ${lowered.sql}`, [
      ...lowered.params,
    ]);
    return indexNames(result.rows[0]['QUERY PLAN']);
  }

  it('finds the matches on the root collection, title matches first, and uses the index', async () => {
    const { db, captured } = ormClient();
    const q = websearchToTsquery(QUERY);

    const rows = await db.Document.select('id', 'title')
      .using.documents_search(q)
      .orderBy((d) => d.id.asc())
      .all();

    expect(rows).toEqual([
      { id: 97, title: 'zebra crossing' },
      { id: 194, title: 'zebra crossing' },
      { id: 291, title: 'zebra crossing' },
      { id: 388, title: 'zebra crossing' },
      { id: 485, title: 'zebra crossing' },
      { id: 582, title: 'zebra crossing' },
      { id: 89, title: 'ordinary title 89' },
      { id: 178, title: 'ordinary title 178' },
      { id: 267, title: 'ordinary title 267' },
      { id: 356, title: 'ordinary title 356' },
      { id: 445, title: 'ordinary title 445' },
      { id: 534, title: 'ordinary title 534' },
    ]);
    expect(await explainedIndexes(captured[0])).toContain(searchIndex.name);
  });

  it('ranks a title match above a body match', async () => {
    const { db } = ormClient();

    const rows = await db.Document.select('id', 'body')
      .where((d) => d.id.in([89, 97]))
      .using.documents_search(websearchToTsquery(QUERY))
      .all();

    expect(rows).toEqual([
      { id: 97, body: 'filler body 97' },
      { id: 89, body: 'a zebra grazes here' },
    ]);
  });

  it('keeps an orderBy given before it ahead of the relevance order', async () => {
    const { db } = ormClient();

    const rows = await db.Document.select('id')
      .where((d) => d.id.in([89, 97, 178, 194]))
      .orderBy((d) => d.id.desc())
      .using.documents_search(websearchToTsquery(QUERY))
      .all();

    expect(rows).toEqual([{ id: 194 }, { id: 178 }, { id: 97 }, { id: 89 }]);
  });

  it('gives the same rows after limit, on this in a custom class, inside with and inside a fragment', async () => {
    const { db, captured } = ormClient();
    const q = websearchToTsquery(QUERY);
    const fragment = db.Document.fragment((documents) => documents.using.documents_search(q));

    const afterLimit = await db.Document.limit(3)
      .using.documents_search(q)
      .orderBy((d) => d.id.asc())
      .select('id')
      .all();
    const fromMethod = await db.Document.search(QUERY)
      .orderBy((d) => d.id.asc())
      .select('id')
      .limit(3)
      .all();
    const fromWith = await db.Document.with((d) => d.using.documents_search(q))
      .orderBy((d) => d.id.asc())
      .select('id')
      .limit(3)
      .all();
    const fromFragment = await db.Document.with(fragment)
      .orderBy((d) => d.id.asc())
      .select('id')
      .limit(3)
      .all();

    expect({ afterLimit, fromMethod, fromWith, fromFragment }).toEqual({
      afterLimit: [{ id: 97 }, { id: 194 }, { id: 291 }],
      fromMethod: [{ id: 97 }, { id: 194 }, { id: 291 }],
      fromWith: [{ id: 97 }, { id: 194 }, { id: 291 }],
      fromFragment: [{ id: 97 }, { id: 194 }, { id: 291 }],
    });
    expect(await explainedIndexes(captured[1])).toContain(searchIndex.name);
  });

  it('searches the related rows inside an include refinement', async () => {
    const { db, captured } = ormClient();
    const q = websearchToTsquery(QUERY);

    const rows = await db.Document.select('id')
      .where((d) => d.id.in([56, 88, 89]))
      .include('children', (children) => children.select('id').using.documents_search(q))
      .orderBy((d) => d.id.asc())
      .all();

    expect(rows).toEqual([
      { id: 56, children: [{ id: 356 }] },
      { id: 88, children: [{ id: 388 }] },
      { id: 89, children: [] },
    ]);
    expect(await explainedIndexes(captured[0])).toContain(searchIndex.name);
  });
});
