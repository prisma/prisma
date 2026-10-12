import { asNamespaceId, type Contract, coreHash, profileHash } from '@internal/contract/types';
import {
  APP_SPACE_ID,
  type MigrationOperationPolicy,
  planOriginOf,
} from '@internal/framework-components/control';
import { UNBOUND_NAMESPACE_ID } from '@internal/framework-components/ir';
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
  frameworkComponents,
  sqliteTargetDescriptor,
  synthEdges,
  type TestDatabase,
} from './fixtures/runner-fixtures';

const DB_UPDATE: MigrationOperationPolicy = {
  allowedOperationClasses: ['additive', 'widening', 'destructive'],
};

const integer = { dataType: 'sqlite/integer', codecId: 'sqlite/integer@1', nullable: false };
const text = { dataType: 'sqlite/text', codecId: 'sqlite/text@1', nullable: false };
const optionalText = { ...text, nullable: true };

type Column = typeof integer | typeof text | typeof optionalText;

function itemContract(
  columns: Readonly<Record<string, Column>>,
  seed: string,
  uniques: readonly string[] = [],
): Contract<SqlStorage> {
  return {
    target: 'sqlite',
    targetFamily: 'sql',
    profileHash: profileHash('required-column-rows'),
    storage: new SqlStorage({
      storageHash: coreHash(seed),
      namespaces: {
        [UNBOUND_NAMESPACE_ID]: sqliteCreateNamespace({
          id: UNBOUND_NAMESPACE_ID,
          entries: {
            table: {
              Item: {
                columns,
                primaryKey: { columns: ['id'] },
                uniques: uniques.map((column) => ({ columns: [column] })),
                indexes: [],
                foreignKeys: [],
              },
            },
          },
        }),
      },
    }),
    roots: {},
    domain: applicationDomainOf({
      models: {
        Item: {
          fields: Object.fromEntries(
            Object.entries(columns).map(([field, column]) => [
              field,
              { nullable: column.nullable, type: { kind: 'scalar', codecId: column.codecId } },
            ]),
          ),
          relations: {},
          storage: {
            table: 'Item',
            namespaceId: UNBOUND_NAMESPACE_ID,
            fields: Object.fromEntries(Object.keys(columns).map((column) => [column, { column }])),
          },
        },
      },
    }),
    capabilities: {},
    extensions: {},
    meta: {},
  };
}

const optionalNote = itemContract({ id: integer, note: optionalText }, 'a'.repeat(64));
const requiredNote = itemContract({ id: integer, note: text }, 'b'.repeat(64));
const withCode = itemContract({ id: integer, note: optionalText, code: text }, 'c'.repeat(64), [
  'code',
]);

describe('a SQLite column that becomes required while rows have no value', {
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
      policy: DB_UPDATE,
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

  function execute(planned: ReturnType<typeof plan>, contract: Contract<SqlStorage>) {
    const { driver } = testDb;
    return sqliteTargetDescriptor.createRunner(familyInstance).execute({
      driver,
      perSpaceOptions: [
        {
          space: APP_SPACE_ID,
          plan: planned,
          migrationEdges: synthEdges(planned),
          driver,
          destinationContract: contract,
          policy: DB_UPDATE,
          frameworkComponents,
        },
      ],
    });
  }

  async function seeded(notes: readonly (string | null)[]) {
    testDb = createTestDatabase();
    expect((await execute(plan(null, optionalNote), optionalNote)).ok).toBe(true);
    for (const [index, note] of notes.entries()) {
      await testDb.driver.query('INSERT INTO "Item" (id, note) VALUES (?, ?)', [index + 1, note]);
    }
  }

  const item = asNamespaceId(UNBOUND_NAMESPACE_ID);

  it('counts the rows that hold NULL, names the field, and applies once they hold values', async () => {
    await seeded([null, 'a', null, null]);
    const result = await execute(plan(optionalNote, requiredNote), requiredNote);
    expect(result.ok ? undefined : result.failure).toMatchObject({
      code: 'MIGRATION.EXECUTION_FAILED',
      summary: '3 rows of "Item" hold NULL in "note", so it cannot become required.',
      rowsWithoutValue: {
        field: { kind: 'field', namespaceId: item, model: 'Item', field: 'note' },
        reason: 'nullValues',
        rows: 3,
        operationIndex: 0,
      },
    });
    expect((await testDb.driver.query('SELECT COUNT(*) AS n FROM "Item"')).rows).toEqual([
      { n: 4 },
    ]);

    await testDb.driver.query(`UPDATE "Item" SET note = 'x' WHERE note IS NULL`);
    expect((await execute(plan(optionalNote, requiredNote), requiredNote)).ok).toBe(true);
  });

  it('counts the rows a new required column has no value for', async () => {
    await seeded(['a', 'b']);
    const result = await execute(plan(optionalNote, withCode), withCode);
    expect(result.ok ? undefined : result.failure).toMatchObject({
      summary:
        '"Item" has 2 rows, so the new required column "code" cannot be added: it can be added to an empty table only.',
      rowsWithoutValue: {
        field: { model: 'Item', field: 'code' },
        reason: 'newField',
        rows: 2,
      },
    });
  });
});
