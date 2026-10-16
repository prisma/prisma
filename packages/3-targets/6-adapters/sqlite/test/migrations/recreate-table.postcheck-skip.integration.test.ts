import { asNamespaceId, type Contract, coreHash, profileHash } from '@internal/contract/types';
import {
  APP_SPACE_ID,
  type MigrationOperationPolicy,
  planOriginOf,
} from '@internal/framework-components/control';
import { UNBOUND_NAMESPACE_ID } from '@internal/framework-components/ir';
import type { ReferentialAction, StorageColumn } from '@internal/sql-contract/types';
import { SqlStorage } from '@internal/sql-contract/types';
import { sqliteCreateNamespace } from '@internal/target-sqlite/control';
import { createSqliteMigrationPlanner } from '@internal/target-sqlite/planner';
import { applicationDomainOf, timeouts } from '@repo/test-utils';
import { afterEach, describe, expect, it } from 'vitest';
import {
  controlAdapter,
  createTestDatabase,
  emptySchema,
  familyInstance,
  formatRunnerFailure,
  frameworkComponents,
  sqliteTargetDescriptor,
  synthEdges,
  type TestDatabase,
} from './fixtures/runner-fixtures';

const ALL_CLASSES: MigrationOperationPolicy = {
  allowedOperationClasses: ['additive', 'widening', 'destructive', 'data'],
};

const integer: StorageColumn = {
  many: false,
  dataType: 'sqlite/integer',
  codecId: 'sqlite/integer@1',
  nullable: false,
};

function contractOf(
  name: string,
  tables: Parameters<typeof sqliteCreateNamespace>[0]['entries']['table'],
): Contract<SqlStorage> {
  return {
    target: 'sqlite',
    targetFamily: 'sql',
    profileHash: profileHash('recreate-table-postcheck-skip'),
    storage: new SqlStorage({
      storageHash: coreHash(name),
      namespaces: {
        [UNBOUND_NAMESPACE_ID]: sqliteCreateNamespace({
          id: UNBOUND_NAMESPACE_ID,
          entries: { table: tables },
        }),
      },
    }),
    roots: {},
    domain: applicationDomainOf({ models: {} }),
    capabilities: {},
    extensions: {},
    meta: {},
  };
}

function postContract(onDelete: ReferentialAction): Contract<SqlStorage> {
  return contractOf(`post-${onDelete}`, {
    User: {
      columns: { id: integer },
      primaryKey: { columns: ['id'] },
      uniques: [],
      indexes: [],
      foreignKeys: [],
    },
    Post: {
      columns: { id: integer, authorId: { ...integer, nullable: true } },
      primaryKey: { columns: ['id'] },
      uniques: [],
      indexes: [],
      foreignKeys: [
        {
          source: {
            namespaceId: asNamespaceId(UNBOUND_NAMESPACE_ID),
            tableName: 'Post',
            columns: ['authorId'],
          },
          target: {
            namespaceId: asNamespaceId(UNBOUND_NAMESPACE_ID),
            tableName: 'User',
            columns: ['id'],
          },
          onDelete,
        },
      ],
    },
  });
}

function counterContract(autoincrement: boolean): Contract<SqlStorage> {
  return contractOf(`counter-${autoincrement}`, {
    Counter: {
      columns: {
        id: autoincrement
          ? { ...integer, default: { kind: 'function', expression: 'autoincrement()' } }
          : integer,
      },
      primaryKey: { columns: ['id'] },
      uniques: [],
      indexes: [],
      foreignKeys: [],
    },
  });
}

describe('a SQLite rebuild whose change the table-level postchecks miss', {
  timeout: timeouts.databaseOperation,
}, () => {
  let testDb: TestDatabase;

  afterEach(() => {
    testDb?.cleanup();
  });

  function plan(from: Contract<SqlStorage> | null, to: Contract<SqlStorage>) {
    const schema =
      from === null
        ? emptySchema
        : sqliteTargetDescriptor.migrations.contractToSchema(from, frameworkComponents);
    const result = createSqliteMigrationPlanner(controlAdapter).plan({
      contract: to,
      schema,
      policy: ALL_CLASSES,
      fromContract: from,
      origin: planOriginOf(from),
      statements: [],
      frameworkComponents,
      spaceId: APP_SPACE_ID,
      snapshotsImportPath: '../../snapshots',
    });
    if (result.kind !== 'success') throw new Error(JSON.stringify(result.conflicts));
    return result.plan;
  }

  async function execute(planned: ReturnType<typeof plan>, contract: Contract<SqlStorage>) {
    const { driver } = testDb;
    const result = await sqliteTargetDescriptor.createRunner(familyInstance).execute({
      driver,
      perSpaceOptions: [
        {
          space: APP_SPACE_ID,
          plan: planned,
          migrationEdges: synthEdges(planned),
          driver,
          destinationContract: contract,
          policy: ALL_CLASSES,
          frameworkComponents,
        },
      ],
    });
    if (!result.ok) throw new Error(formatRunnerFailure(result.failure));
    return result.value.perSpaceResults[0]?.value;
  }

  async function migrate(origin: Contract<SqlStorage>, destination: Contract<SqlStorage>) {
    testDb = createTestDatabase();
    await execute(plan(null, origin), origin);
    return execute(plan(origin, destination), destination);
  }

  it('runs a rebuild that changes only a foreign key action', async () => {
    const result = await migrate(postContract('cascade'), postContract('setNull'));

    const actions = await testDb.driver.query(
      `SELECT on_delete FROM pragma_foreign_key_list('Post')`,
    );
    expect({ result, actions: actions.rows }).toMatchObject({
      result: { operationsExecuted: 1 },
      actions: [{ on_delete: 'SET NULL' }],
    });
  });

  async function tableSql(): Promise<string | undefined> {
    const table = await testDb.driver.query<{ sql: string }>(
      `SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'Counter'`,
    );
    return table.rows[0]?.sql;
  }

  it('runs a rebuild that only adds autoincrement()', async () => {
    const result = await migrate(counterContract(false), counterContract(true));

    expect({ result, sql: await tableSql() }).toMatchObject({
      result: { operationsExecuted: 1 },
      sql: expect.stringContaining('AUTOINCREMENT'),
    });
  });

  it('runs a rebuild that only removes autoincrement()', async () => {
    const result = await migrate(counterContract(true), counterContract(false));

    expect({ result, sql: await tableSql() }).toMatchObject({
      result: { operationsExecuted: 1 },
      sql: expect.not.stringContaining('AUTOINCREMENT'),
    });
  });
});
