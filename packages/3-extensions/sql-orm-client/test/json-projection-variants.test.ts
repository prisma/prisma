import { createPostgresAdapter } from '@prisma-next/adapter-postgres/adapter';
import { createSqliteAdapter } from '@prisma-next/adapter-sqlite/adapter';
import {
  CodecJsonValueProjection,
  ColumnRef,
  JsonDocumentProjection,
  JsonObjectExpr,
  NativeJsonValueProjection,
  ProjectionItem,
  SelectAst,
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
});

describe('JSON projection variants', () => {
  const postgresAdapter = createPostgresAdapter();
  const sqliteAdapter = createSqliteAdapter();

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

    const variants = {
      codec: new CodecJsonValueProjection(value, codecRef),
      native: new NativeJsonValueProjection(value),
      document: new JsonDocumentProjection(value),
    };

    it.each([
      ['PostgreSQL', postgresAdapter, baseContract],
      ['SQLite', sqliteAdapter, sqliteContract],
    ] as const)('%s renders all three identically', (_label, adapter, contract) => {
      const rendered = Object.values(variants).map(
        (variant) =>
          adapter.lower(
            selectProjecting(JsonObjectExpr.fromEntries([JsonObjectExpr.entry('price', variant)])),
            {
              contract,
            },
          ).sql,
      );

      expect(new Set(rendered).size).toBe(1);
    });
  });
});
