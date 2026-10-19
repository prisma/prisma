/**
 * A primary key whose columns change, or that is removed, is dropped and added back. Postgres refuses to drop a key while a foreign key depends on its index, so every foreign key that references the old key's columns is dropped first and, when the end contract keeps it, added back after the new key.
 */
import { asNamespaceId, type Contract, coreHash, profileHash } from '@internal/contract/types';
import type { ExecuteRequestLowerer } from '@internal/family-sql/control-adapter';
import {
  APP_SPACE_ID,
  type MigrationOperationClass,
  type SchemaDiffIssue,
  type SchemaOwnership,
} from '@internal/framework-components/control';
import {
  type ReferentialAction,
  SqlStorage,
  StorageTable,
  type StorageTableInput,
} from '@internal/sql-contract/types';
import { RelationalSchemaNodeKind } from '@internal/sql-schema-ir/types';
import { applicationDomainOf } from '@repo/test-utils';
import { describe, expect, it } from 'vitest';
import { buildPostgresPlanDiff } from '../../src/core/migrations/diff-database-schema';
import {
  type CallMigrationStrategy,
  coalesceSubtreeIssues,
  issueNode,
  planIssues,
} from '../../src/core/migrations/issue-planner';
import { createPostgresMigrationPlanner } from '../../src/core/migrations/planner';
import { postgresContractToSchema } from '../../src/core/migrations/postgres-contract-to-schema';
import { primaryKeyChangeStrategy } from '../../src/core/migrations/primary-key-change';
import { PostgresSchema } from '../../src/core/postgres-schema';
import { postgresTypeComponents, postgresTypeLookups } from '../postgres-type-lookups';
import { planTrees } from './node-issue-planner-fixtures';

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

function plan(from: Contract<SqlStorage>, to: Contract<SqlStorage>, ownership?: SchemaOwnership) {
  return createPostgresMigrationPlanner(stubLowerer).plan({
    contract: to,
    schema: postgresContractToSchema(from, postgresTypeComponents),
    policy: { allowedOperationClasses: [...ALL_CLASSES] },
    fromContract: from,
    origin: null,
    statements: [],
    frameworkComponents: postgresTypeComponents,
    spaceId: APP_SPACE_ID,
    snapshotsImportPath: '../../snapshots',
    ...(ownership === undefined ? {} : { ownership }),
  });
}

async function plannedOperations(from: Contract<SqlStorage>, to: Contract<SqlStorage>) {
  const result = plan(from, to);
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

describe('a primary key change the plan cannot make', () => {
  const why =
    'Drop or change that foreign key yourself, then plan again, or use `migration new` to author a custom migration for this change.';

  it('refuses when a foreign key on a table the control policy keeps the plan away from references the key', () => {
    const externalEntry = { ...entry, control: 'external' as const };
    const before = contractOf({
      public: { user: user({ primaryKey: ['id'] }) },
      audit: { entry: externalEntry },
    });
    const after = contractOf({
      public: { user: user({ primaryKey: ['id', 'email'], uniques: [['id']] }) },
      audit: { entry: externalEntry },
    });

    expect(plan(before, after)).toMatchObject({
      kind: 'failure',
      conflicts: [
        {
          kind: 'foreignKeyConflict',
          summary:
            'Primary key "user_pkey" on "public"."user" cannot change while foreign key "entry_userId_fkey" on "audit"."entry" references it, and the control policy does not let this plan change "audit"."entry".',
          why,
          location: { entityKind: 'table', entityName: 'entry', constraint: 'entry_userId_fkey' },
        },
      ],
    });
  });

  it('refuses when the end contract leaves out a referencing foreign key whose table the plan does not drop', () => {
    const before = contractOf({ public: { user: user({ primaryKey: ['id'] }), post: post() } });
    const after = contractOf({
      public: { user: user({ primaryKey: ['id', 'email'], uniques: [['id']] }) },
    });
    const postOwnedElsewhere: SchemaOwnership = {
      declaresEntity: (coordinate) => coordinate.entityName === 'post',
    };

    expect(plan(before, after, postOwnedElsewhere)).toMatchObject({
      kind: 'failure',
      conflicts: [
        {
          kind: 'foreignKeyConflict',
          summary:
            'Primary key "user_pkey" on "public"."user" cannot change while foreign key "post_authorId_fkey" on "public"."post" references it, and the end contract has no such foreign key while this plan does not drop "public"."post".',
          why,
          location: { entityKind: 'table', entityName: 'post', constraint: 'post_authorId_fkey' },
        },
      ],
    });
  });
});

describe('a composite primary key', () => {
  it('drops and adds back a foreign key that lists the key columns in another order', async () => {
    const account = (key: readonly string[], uniques: readonly (readonly string[])[]) =>
      table({
        columns: { tenantId: int4, id: int4, email: text },
        primaryKey: { columns: [...key] },
        uniques: uniques.map((columns) => ({ columns: [...columns] })),
      });
    const invoice = table({
      columns: { id: int4, accountId: int4, accountTenantId: int4 },
      primaryKey: { columns: ['id'] },
      foreignKeys: [
        foreignKey(
          { namespace: 'public', table: 'invoice', columns: ['accountId', 'accountTenantId'] },
          { namespace: 'public', table: 'account', columns: ['id', 'tenantId'] },
        ),
      ],
    });
    const before = contractOf({ public: { account: account(['tenantId', 'id'], []), invoice } });
    const after = contractOf({
      public: {
        account: account(['tenantId', 'id', 'email'], [['id', 'tenantId']]),
        invoice,
      },
    });

    expect(await plannedOperations(before, after)).toEqual([
      'Drop constraint "invoice_accountId_accountTenantId_fkey" on "invoice"',
      'Drop constraint "account_pkey" on "account"',
      'Add primary key on "account"',
      'Add unique constraint on "account" (id, tenantId)',
      'Add foreign key "invoice_accountId_accountTenantId_fkey" on "invoice"',
    ]);
  });
});

describe('a referencing foreign key an earlier strategy already planned', () => {
  it('is not dropped a second time', () => {
    const before = contractOf({ public: { user: user({ primaryKey: ['id'] }), post: post() } });
    const after = contractOf({
      public: {
        user: user({ primaryKey: ['id', 'email'], uniques: [['id']] }),
        post: post({ onDelete: 'cascade' }),
      },
    });
    const start = postgresContractToSchema(before, postgresTypeComponents);
    const { issues, expected } = buildPostgresPlanDiff({
      contract: after,
      actualSchema: start,
      frameworkComponents: postgresTypeComponents,
    });
    const isForeignKeyIssue = (issue: SchemaDiffIssue) =>
      issueNode(issue)?.nodeKind === RelationalSchemaNodeKind.foreignKey;
    const takeForeignKeyIssues: CallMigrationStrategy = (strategyIssues) => ({
      kind: 'match',
      issues: strategyIssues.filter((issue) => !isForeignKeyIssue(issue)),
      calls: [],
    });

    const result = planIssues({
      issues: coalesceSubtreeIssues(issues),
      ...planTrees(start, expected),
      toContract: after,
      fromContract: before,
      schemaName: 'public',
      codecHooks: new Map(),
      types: postgresTypeLookups,
      storageTypes: {},
      strategies: [takeForeignKeyIssues, primaryKeyChangeStrategy],
    });

    if (!result.ok) throw new Error(JSON.stringify(result.failure));
    expect(result.value.calls.map((call) => call.label)).toEqual([
      'Drop constraint "user_managerId_fkey" on "user"',
      'Drop constraint "user_pkey" on "user"',
      'Add primary key on "user"',
      'Add unique constraint on "user" (id)',
      'Add foreign key "user_managerId_fkey" on "user"',
    ]);
  });
});
