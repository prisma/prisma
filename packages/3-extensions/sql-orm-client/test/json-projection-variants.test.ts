import { createPostgresAdapter } from '@prisma-next/adapter-postgres/adapter';
import { createSqliteAdapter } from '@prisma-next/adapter-sqlite/adapter';
import type { SqliteContract } from '@prisma-next/adapter-sqlite/types';
import {
  type AnyJsonValueProjection,
  CodecJsonValueProjection,
  ColumnRef,
  DerivedTableSource,
  JsonArrayAggExpr,
  JsonDocumentProjection,
  JsonObjectExpr,
  NativeJsonValueProjection,
  ProjectionItem,
  SelectAst,
  SubqueryExpr,
  TableSource,
} from '@prisma-next/sql-relational-core/ast';
import { applicationDomainOf } from '@prisma-next/test-utils';
import { describe, expect, it } from 'vitest';
import { TestSqlContractSerializer } from '../../../2-sql/9-family/test/test-sql-contract-serializer';
import { compileSelectWithIncludes } from '../src/query-plan-select';
import { baseContract, createCollection, createCollectionFor } from './collection-fixtures';

/**
 * Representative plans, one per shape that emits JSON entries: a plain
 * include, a nested include, an aggregate include, a combine, an include
 * carrying `distinct` (the ROW_NUMBER-ranked path), and a distinct non-leaf
 * include (the ranked path with grandchildren attached).
 */
function representativePlans(): ReadonlyArray<readonly [string, SelectAst]> {
  const { collection: users } = createCollection();
  const { collection: projects } = createCollectionFor('Project');
  const cases = [
    ['plain include', 'users', users.include('posts').state],
    ['nested include', 'users', users.include('posts', (posts) => posts.include('comments')).state],
    ['aggregate include', 'users', users.include('posts', (posts) => posts.count()).state],
    [
      'aggregate include over a column',
      'users',
      users.include('posts', (posts) => posts.sum('views')).state,
    ],
    [
      'combine of a row branch and a scalar branch',
      'users',
      users.include('posts', (posts) =>
        posts.combine({
          recent: posts.orderBy((post) => post.id.desc()).take(3),
          total: posts.count(),
        }),
      ).state,
    ],
    [
      'include with distinct',
      'users',
      users.include('posts', (posts) => posts.distinct('title')).state,
    ],
    [
      'distinct non-leaf include',
      'users',
      users.include('posts', (posts) => posts.distinct('title').include('comments')).state,
    ],
    ['many-to-many include', 'users', users.include('tags').state],
    ['self-relation many-to-many include', 'projects', projects.include('related').state],
  ] as const;

  return cases.map(([label, table, state]) => {
    const plan = compileSelectWithIncludes(baseContract, 'public', table, state);
    return [label, plan.ast as SelectAst] as const;
  });
}

/**
 * The SQLite arm needs a SQLite-flavoured contract of its own: the ORM
 * fixtures are PostgreSQL, and an adapter resolves codecs out of the contract
 * it is handed.
 */
const sqliteContract = new TestSqlContractSerializer().deserializeContract({
  target: 'sqlite',
  targetFamily: 'sql',
  profileHash: 'test-profile',
  roots: {},
  capabilities: {},
  extensions: {},
  meta: {},
  storage: {
    storageHash: 'test-core',
    namespaces: {
      __unbound__: {
        id: '__unbound__',
        entries: {
          table: {
            post: {
              columns: {
                id: { codecId: 'sqlite/integer@1', nativeType: 'integer', nullable: false },
                price: { codecId: 'sqlite/bigint@1', nativeType: 'text', nullable: false },
              },
              uniques: [],
              indexes: [],
              foreignKeys: [],
            },
          },
        },
      },
    },
  },
  domain: applicationDomainOf({ models: {} }),
}) as SqliteContract;

/**
 * Every JSON entry a plan emits, as `<key>:<variant>` — plus the codec id
 * where the variant is `codec`, since a codec entry naming the wrong codec is
 * as wrong as the wrong variant. `json_agg`'s aggregated element has no key of
 * its own and reads as `[]`.
 */
function jsonEntriesOf(ast: SelectAst): string[] {
  const found: string[] = [];

  const describeProjection = (key: string, projection: AnyJsonValueProjection): void => {
    found.push(
      projection instanceof CodecJsonValueProjection
        ? `${key}:codec(${projection.codec.codecId})`
        : `${key}:${projection.kind}`,
    );
    walkExpr(projection.value);
  };

  function walkExpr(expr: unknown): void {
    if (expr instanceof JsonObjectExpr) {
      for (const entry of expr.entries) describeProjection(entry.key, entry.value);
      return;
    }
    if (expr instanceof JsonArrayAggExpr) {
      describeProjection('[]', expr.expr);
      return;
    }
    if (expr instanceof SubqueryExpr) {
      walkSelect(expr.query);
    }
  }

  function walkSelect(select: SelectAst): void {
    for (const item of select.projection) walkExpr(item.expr);
    if (select.from instanceof DerivedTableSource) walkSelect(select.from.query);
    for (const join of select.joins ?? []) {
      if (join.source instanceof DerivedTableSource) walkSelect(join.source.query);
    }
  }

  walkSelect(ast);
  return found;
}

describe('JSON projection variants', () => {
  const postgresAdapter = createPostgresAdapter();
  const sqliteAdapter = createSqliteAdapter();

  /**
   * What the planner now states about each entry it emits. These fail if the
   * planner stops choosing variants — which the SQL baseline below cannot
   * catch, since an unchosen variant renders exactly like a chosen one.
   */
  describe('states the identity of every value it puts into JSON', () => {
    const planned = new Map(representativePlans());

    function entriesFor(label: string): string[] {
      const ast = planned.get(label);
      if (ast === undefined) throw new Error(`no representative plan labelled '${label}'`);
      return jsonEntriesOf(ast);
    }

    it('gives a child row set codec entries for its columns and a document for the row', () => {
      expect(entriesFor('plain include')).toEqual([
        '[]:document',
        'embedding:codec(pg/vector@1)',
        'id:codec(pg/int4@1)',
        'title:codec(pg/text@1)',
        'user_id:codec(pg/int4@1)',
        'views:codec(pg/int4@1)',
      ]);
    });

    it('gives a nested include a document entry, and its own columns codec entries', () => {
      expect(entriesFor('nested include')).toEqual([
        '[]:document',
        'embedding:codec(pg/vector@1)',
        'id:codec(pg/int4@1)',
        'title:codec(pg/text@1)',
        'user_id:codec(pg/int4@1)',
        'views:codec(pg/int4@1)',
        'comments:document',
        '[]:document',
        'body:codec(pg/text@1)',
        'id:codec(pg/int4@1)',
        'post_id:codec(pg/int4@1)',
      ]);
    });

    it('leaves an aggregate native — a computed value carries no codec', () => {
      expect(entriesFor('aggregate include')).toEqual(['value:native']);
      expect(entriesFor('aggregate include over a column')).toEqual(['value:native']);
    });

    it('gives every combine branch a document entry, whatever the branch is', () => {
      expect(entriesFor('combine of a row branch and a scalar branch')).toEqual([
        'recent:document',
        'total:document',
        '[]:document',
        'embedding:codec(pg/vector@1)',
        'id:codec(pg/int4@1)',
        'title:codec(pg/text@1)',
        'user_id:codec(pg/int4@1)',
        'views:codec(pg/int4@1)',
        'value:native',
      ]);
    });

    it('keeps the identities through the ranked distinct path', () => {
      expect(entriesFor('distinct non-leaf include')).toEqual([
        '[]:document',
        'embedding:codec(pg/vector@1)',
        'id:codec(pg/int4@1)',
        'title:codec(pg/text@1)',
        'user_id:codec(pg/int4@1)',
        'views:codec(pg/int4@1)',
        'comments:document',
        '[]:document',
        'body:codec(pg/text@1)',
        'id:codec(pg/int4@1)',
        'post_id:codec(pg/int4@1)',
      ]);
    });

    it('reaches the child columns of a many-to-many include across the junction', () => {
      expect(entriesFor('many-to-many include')).toEqual([
        '[]:document',
        'id:codec(sql/char@1)',
        'name:codec(pg/text@1)',
      ]);
    });

    it('no entry is left native except the aggregates', () => {
      const natives = [...planned].flatMap(([label, ast]) =>
        jsonEntriesOf(ast)
          .filter((entry) => entry.endsWith(':native'))
          .map((entry) => `${label} ${entry}`),
      );

      expect(natives).toEqual([
        'aggregate include value:native',
        'aggregate include over a column value:native',
        'combine of a row branch and a scalar branch value:native',
      ]);
    });
  });

  /**
   * The baseline: the SQL these plans rendered before the ORM chose variants.
   * Recorded from the planner as it stood, and asserted unchanged afterwards.
   *
   * A variant choice that reached the rendered SQL — a codec entry the planner
   * put where a document belongs, an entry that stopped being emitted, a plan
   * shape that moved — changes one of these strings and fails here. What it
   * cannot catch on its own is the planner not choosing variants at all, which
   * is what the emission assertions below are for; the two together say
   * "the ORM now states the semantics, and the SQL did not move".
   */
  describe('renders the SQL it rendered before variants were chosen', () => {
    for (const [label, ast] of representativePlans()) {
      it(label, () => {
        expect(postgresAdapter.lower(ast, { contract: baseContract }).sql).toMatchSnapshot();
      });
    }
  });

  /**
   * Why that parity holds: both renderers dispatch the three variants to the
   * same rendering. This is the dispatch's dormancy evidence — the emission
   * change cannot be observed until a renderer stops being indifferent, which
   * is what the renderer flips do next. These assertions are expected to fail
   * then, and that failure is the cut becoming visible rather than a defect.
   */
  describe('both renderers are indifferent to the variant', () => {
    const value = ColumnRef.of('post', 'price');
    const codecRef = { codecId: 'irrelevant/codec@1', typeParams: {}, many: false } as const;

    function selectProjecting(entry: JsonObjectExpr): SelectAst {
      return SelectAst.from(TableSource.named('post')).withProjection([
        ProjectionItem.of('json', entry),
      ]);
    }

    const variants = [
      new CodecJsonValueProjection(value, codecRef),
      new NativeJsonValueProjection(value),
      new JsonDocumentProjection(value),
    ];

    function selectsProjecting(): SelectAst[] {
      return variants.map((variant) =>
        selectProjecting(JsonObjectExpr.fromEntries([JsonObjectExpr.entry('price', variant)])),
      );
    }

    it('PostgreSQL renders all three identically', () => {
      const rendered = selectsProjecting().map(
        (ast) => postgresAdapter.lower(ast, { contract: baseContract }).sql,
      );

      expect(new Set(rendered).size).toBe(1);
    });

    it('SQLite renders all three identically', () => {
      const rendered = selectsProjecting().map(
        (ast) => sqliteAdapter.lower(ast, { contract: sqliteContract }).sql,
      );

      expect(new Set(rendered).size).toBe(1);
    });
  });
});
