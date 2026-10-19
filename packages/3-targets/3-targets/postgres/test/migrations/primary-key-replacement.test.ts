/**
 * A primary key whose columns change, or that is removed, is dropped and added back. Postgres refuses to drop a key while a foreign key depends on its index, so every foreign key that references the old key's columns is dropped first and, when the end contract keeps it, added back after the new key.
 */
import { asNamespaceId, type Contract, coreHash, profileHash } from '@internal/contract/types';
import type { ExecuteRequestLowerer } from '@internal/family-sql/control-adapter';
import { APP_SPACE_ID, type MigrationOperationClass } from '@internal/framework-components/control';
import {
  type ReferentialAction,
  SqlStorage,
  StorageTable,
  type StorageTableInput,
} from '@internal/sql-contract/types';
import { applicationDomainOf } from '@repo/test-utils';
import { describe, expect, it } from 'vitest';
import { createPostgresMigrationPlanner } from '../../src/core/migrations/planner';
import { postgresContractToSchema } from '../../src/core/migrations/postgres-contract-to-schema';
import { PostgresSchema } from '../../src/core/postgres-schema';
import { postgresTypeComponents } from '../postgres-type-lookups';

const stubLowerer: ExecuteRequestLowerer = {
  lower: () => ({ sql: 'stub', params: [] }),
  renderColumnDefault: async () => '',
  lowerToExecuteRequest: async () => ({ sql: 'stub', params: [] }),
};

const ALL_CLASSES: readonly MigrationOperationClass[] = ['additive', 'widening', 'destructive'];

const int4 = { dataType: 'pg/int4', codecId: 'pg/int4@1', nullable: false } as const;
const text = { dataType: 'pg/text', codecId: 'pg/text@1', nullable: false } as const;

type Tables = Record<string, Record<string, StorageTableInput>>;

function foreignKey(
  from: { namespace: string; table: string; columns: readonly string[] },
  to: { namespace: string; table: string; columns: readonly string[] },
  options: { name?: string; onDelete?: ReferentialAction } = {},
) {
  return {
    source: {
      namespaceId: asNamespaceId(from.namespace),
      tableName: from.table,
      columns: [...from.columns],
    },
    target: {
      namespaceId: asNamespaceId(to.namespace),
      tableName: to.table,
      columns: [...to.columns],
    },
    ...options,
  };
}

function contractOf(tables: Tables): Contract<SqlStorage> {
  const hash = `primary-key-replacement-${JSON.stringify(tables)}`;
  return {
    target: 'postgres',
    targetFamily: 'sql',
    profileHash: profileHash(hash),
    storage: new SqlStorage({
      storageHash: coreHash(hash),
      namespaces: Object.fromEntries(
        Object.entries(tables).map(([id, namespaceTables]) => [
          id,
          new PostgresSchema({
            id,
            entries: {
              table: Object.fromEntries(
                Object.entries(namespaceTables).map(([name, spec]) => [
                  name,
                  new StorageTable(spec),
                ]),
              ),
            },
          }),
        ]),
      ),
    }),
    roots: {},
    domain: applicationDomainOf({ models: {} }),
    capabilities: {},
    extensions: {},
    meta: {},
  };
}

function table(
  spec: Partial<StorageTableInput> & Pick<StorageTableInput, 'columns'>,
): StorageTableInput {
  return { foreignKeys: [], uniques: [], indexes: [], ...spec };
}

const userRef = { namespace: 'public', table: 'user', columns: ['id'] };

interface UserShape {
  readonly primaryKey?: readonly string[];
  readonly uniques?: readonly (readonly string[])[];
}

function user(shape: UserShape) {
  return table({
    columns: { id: int4, email: text, handle: text, managerId: int4 },
    ...(shape.primaryKey === undefined ? {} : { primaryKey: { columns: [...shape.primaryKey] } }),
    uniques: [
      { columns: ['handle'] },
      ...(shape.uniques ?? []).map((columns) => ({ columns: [...columns] })),
    ],
    foreignKeys: [
      foreignKey({ namespace: 'public', table: 'user', columns: ['managerId'] }, userRef),
    ],
  });
}

function post(options: { onDelete?: ReferentialAction } = {}) {
  return table({
    columns: { id: int4, authorId: int4, authorHandle: text },
    primaryKey: { columns: ['id'] },
    foreignKeys: [
      foreignKey({ namespace: 'public', table: 'post', columns: ['authorId'] }, userRef, options),
      foreignKey(
        { namespace: 'public', table: 'post', columns: ['authorHandle'] },
        { namespace: 'public', table: 'user', columns: ['handle'] },
      ),
    ],
  });
}

const entry = table({
  columns: { id: int4, userId: int4 },
  primaryKey: { columns: ['id'] },
  foreignKeys: [foreignKey({ namespace: 'audit', table: 'entry', columns: ['userId'] }, userRef)],
});

async function plannedOperations(from: Contract<SqlStorage>, to: Contract<SqlStorage>) {
  const result = createPostgresMigrationPlanner(stubLowerer).plan({
    contract: to,
    schema: postgresContractToSchema(from, postgresTypeComponents),
    policy: { allowedOperationClasses: [...ALL_CLASSES] },
    fromContract: from,
    origin: null,
    statements: [],
    frameworkComponents: postgresTypeComponents,
    spaceId: APP_SPACE_ID,
    snapshotsImportPath: '../../snapshots',
  });
  if (result.kind !== 'success') throw new Error(JSON.stringify(result));
  const operations = await Promise.all(result.plan.operations);
  return operations.map((operation) => operation.label);
}

describe('a primary key whose columns change', () => {
  it('drops the old key, then adds the new one', async () => {
    const before = contractOf({
      public: {
        tag: table({ columns: { id: int4, name: text }, primaryKey: { columns: ['id'] } }),
      },
    });
    const after = contractOf({
      public: {
        tag: table({ columns: { id: int4, name: text }, primaryKey: { columns: ['id', 'name'] } }),
      },
    });

    expect(await plannedOperations(before, after)).toEqual([
      'Drop constraint "tag_pkey" on "tag"',
      'Add primary key on "tag"',
    ]);
  });

  it('drops and adds back the foreign keys that reference it, in the same table, another table and another namespace', async () => {
    const before = contractOf({
      public: { user: user({ primaryKey: ['id'] }), post: post() },
      audit: { entry },
    });
    const after = contractOf({
      public: { user: user({ primaryKey: ['id', 'email'], uniques: [['id']] }), post: post() },
      audit: { entry },
    });

    expect(await plannedOperations(before, after)).toEqual([
      'Drop constraint "user_managerId_fkey" on "user"',
      'Drop constraint "post_authorId_fkey" on "post"',
      'Drop constraint "entry_userId_fkey" on "entry"',
      'Drop constraint "user_pkey" on "user"',
      'Add primary key on "user"',
      'Add unique constraint on "user" (id)',
      'Add foreign key "user_managerId_fkey" on "user"',
      'Add foreign key "post_authorId_fkey" on "post"',
      'Add foreign key "entry_userId_fkey" on "entry"',
    ]);
  });

  it('drops and adds a referencing foreign key once when its own actions change too', async () => {
    const before = contractOf({ public: { user: user({ primaryKey: ['id'] }), post: post() } });
    const after = contractOf({
      public: {
        user: user({ primaryKey: ['id', 'email'], uniques: [['id']] }),
        post: post({ onDelete: 'cascade' }),
      },
    });

    const labels = await plannedOperations(before, after);

    expect(labels.filter((label) => label.includes('post_authorId_fkey'))).toEqual([
      'Drop constraint "post_authorId_fkey" on "post"',
      'Add foreign key "post_authorId_fkey" on "post"',
    ]);
  });

  it('drops a referencing foreign key on a table the plan drops, and does not add it back', async () => {
    const before = contractOf({ public: { user: user({ primaryKey: ['id'] }), post: post() } });
    const after = contractOf({
      public: { user: user({ primaryKey: ['id', 'email'], uniques: [['id']] }) },
    });

    expect(await plannedOperations(before, after)).toEqual([
      'Drop constraint "user_managerId_fkey" on "user"',
      'Drop constraint "post_authorId_fkey" on "post"',
      'Drop constraint "user_pkey" on "user"',
      'Drop table "post"',
      'Add primary key on "user"',
      'Add unique constraint on "user" (id)',
      'Add foreign key "user_managerId_fkey" on "user"',
    ]);
  });

  it('leaves alone a foreign key that references a unique constraint of the table, not its key', async () => {
    const before = contractOf({ public: { user: user({ primaryKey: ['id'] }), post: post() } });
    const after = contractOf({
      public: { user: user({ primaryKey: ['id', 'email'], uniques: [['id']] }), post: post() },
    });

    const labels = await plannedOperations(before, after);

    expect(labels.filter((label) => label.includes('post_authorHandle_fkey'))).toEqual([]);
  });
});

describe('a primary key that is removed', () => {
  it('drops the foreign keys that reference it first, and adds back the ones the end contract keeps', async () => {
    const before = contractOf({ public: { user: user({ primaryKey: ['id'] }), post: post() } });
    const after = contractOf({ public: { user: user({ uniques: [['id']] }), post: post() } });

    expect(await plannedOperations(before, after)).toEqual([
      'Drop constraint "user_managerId_fkey" on "user"',
      'Drop constraint "post_authorId_fkey" on "post"',
      'Drop constraint "user_pkey" on "user"',
      'Add unique constraint on "user" (id)',
      'Add foreign key "user_managerId_fkey" on "user"',
      'Add foreign key "post_authorId_fkey" on "post"',
    ]);
  });
});

describe('a primary key moved off a column the same plan drops', () => {
  it.each(['id', 'uuid'])('drops the key before the column "%s"', async (oldColumn) => {
    const before = contractOf({
      public: {
        tag: table({
          columns: { [oldColumn]: int4, code: text },
          primaryKey: { columns: [oldColumn] },
        }),
      },
    });
    const after = contractOf({
      public: { tag: table({ columns: { code: text }, primaryKey: { columns: ['code'] } }) },
    });

    expect(await plannedOperations(before, after)).toEqual([
      'Drop constraint "tag_pkey" on "tag"',
      `Drop column "${oldColumn}" from "tag"`,
      'Add primary key on "tag"',
    ]);
  });
});
