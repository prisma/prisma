/**
 * A namespace the origin contract declares and the destination does not: its tables are dropped,
 * each a data-loss question about its model, and then the schema. A schema the origin never
 * declared, such as Supabase's `auth`, is left alone, and so is everything without an origin
 * contract.
 */
import { createHash } from 'node:crypto';
import { asNamespaceId, type Contract, coreHash, profileHash } from '@internal/contract/types';
import { APP_SPACE_ID, planOriginOf } from '@internal/framework-components/control';
import { SqlStorage, StorageTable } from '@internal/sql-contract/types';
import { describe, expect, it } from 'vitest';
import { createPostgresMigrationPlanner } from '../../src/core/migrations/planner';
import { postgresContractToSchema } from '../../src/core/migrations/postgres-contract-to-schema';
import { postgresCreateNamespace } from '../../src/core/postgres-schema';
import type { PostgresDatabaseSchemaNode } from '../../src/core/schema-ir/postgres-database-schema-node';
import { postgresTypeComponents } from '../postgres-type-lookups';
import { stubLowerer } from './rename-table-fixtures';

const ALL_CLASSES = { allowedOperationClasses: ['additive', 'widening', 'destructive'] as const };
const int4 = { dataType: 'pg/int4', codecId: 'pg/int4@1', nullable: false };

function table(): StorageTable {
  return new StorageTable({
    columns: { id: int4 },
    primaryKey: { columns: ['id'] },
    uniques: [],
    indexes: [],
    foreignKeys: [],
  });
}

/** A contract with one model per table, named after it with a capital letter, in each namespace. */
function contractOf(
  namespaces: Readonly<Record<string, readonly string[]>>,
  seed: string,
): Contract<SqlStorage> {
  const modelName = (tableName: string) => `${tableName[0]?.toUpperCase()}${tableName.slice(1)}`;
  return {
    target: 'postgres',
    targetFamily: 'sql',
    profileHash: profileHash(seed),
    storage: new SqlStorage({
      storageHash: coreHash(createHash('sha256').update(seed).digest('hex')),
      namespaces: Object.fromEntries(
        Object.entries(namespaces).map(([id, tables]) => [
          id,
          postgresCreateNamespace({
            id,
            entries: { table: Object.fromEntries(tables.map((name) => [name, table()])) },
          }),
        ]),
      ),
    }),
    roots: {},
    domain: {
      namespaces: Object.fromEntries(
        Object.entries(namespaces).map(([id, tables]) => [
          id,
          {
            models: Object.fromEntries(
              tables.map((name) => [
                modelName(name),
                {
                  fields: {},
                  relations: {},
                  storage: { table: name, namespaceId: id, fields: {} },
                },
              ]),
            ),
          },
        ]),
      ),
    },
    capabilities: {},
    extensions: {},
    meta: {},
  };
}

function plan(
  from: Contract<SqlStorage>,
  to: Contract<SqlStorage>,
  options: {
    readonly fromContract?: Contract<SqlStorage> | null;
    readonly schema?: PostgresDatabaseSchemaNode;
  } = {},
) {
  const fromContract = options.fromContract === undefined ? from : options.fromContract;
  return createPostgresMigrationPlanner(stubLowerer).plan({
    contract: to,
    schema: options.schema ?? postgresContractToSchema(from, postgresTypeComponents),
    policy: ALL_CLASSES,
    fromContract,
    origin: fromContract === null ? null : planOriginOf(fromContract),
    statements: [],
    frameworkComponents: postgresTypeComponents,
    spaceId: APP_SPACE_ID,
    snapshotsImportPath: '../../snapshots',
  });
}

async function planned(result: ReturnType<typeof plan>) {
  if (result.kind !== 'success') {
    throw new Error(`expected a plan, got ${JSON.stringify(result.conflicts)}`);
  }
  const ops = await Promise.all(result.plan.operations);
  return { labels: ops.map((op) => op.label), dataLoss: result.dataLoss };
}

const withBilling = contractOf({ public: ['user'], billing: ['invoice', 'receipt'] }, 'with');
const withoutBilling = contractOf({ public: ['user'] }, 'without');

describe('Postgres planner, a namespace the destination removes', () => {
  it('drops each of its tables, each a question about its model, and then the schema', async () => {
    expect(await planned(plan(withBilling, withoutBilling))).toEqual({
      labels: ['Drop table "invoice"', 'Drop table "receipt"', 'Drop schema "billing"'],
      dataLoss: [
        expect.objectContaining({
          operationIndex: 0,
          subject: { kind: 'model', namespaceId: asNamespaceId('billing'), model: 'Invoice' },
        }),
        expect.objectContaining({
          operationIndex: 1,
          subject: { kind: 'model', namespaceId: asNamespaceId('billing'), model: 'Receipt' },
        }),
      ],
    });
  });

  it('leaves the namespace alone without an origin contract', async () => {
    expect(await planned(plan(withBilling, withoutBilling, { fromContract: null }))).toEqual({
      labels: [],
      dataLoss: [],
    });
  });

  it('leaves alone a schema the origin never declared, such as auth', async () => {
    const live = postgresContractToSchema(
      contractOf({ public: ['user'], auth: ['users'] }, 'live'),
      postgresTypeComponents,
    );

    expect(
      await planned(
        plan(withoutBilling, withoutBilling, { schema: live, fromContract: withoutBilling }),
      ),
    ).toEqual({ labels: [], dataLoss: [] });
  });

  it('drops the tables of public but never the schema itself', async () => {
    const inPublic = contractOf({ public: ['user'], billing: ['invoice'] }, 'in-public');
    const onlyBilling = contractOf({ billing: ['invoice'] }, 'only-billing');

    expect((await planned(plan(inPublic, onlyBilling))).labels).toEqual(['Drop table "user"']);
  });
});
