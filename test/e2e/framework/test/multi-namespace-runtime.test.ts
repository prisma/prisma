/**
 * Multi-namespace Postgres contract queryable end-to-end (PGlite).
 *
 * Proves runtime SQL qualification routes DML to the schema named on each
 * model's namespace coordinate (auth vs public), not only the default namespace.
 */

import { postgresRawCodecInferer } from '@prisma-next/adapter-postgres/adapter';
import postgresAdapter from '@prisma-next/adapter-postgres/runtime';
import { asNamespaceId, type Contract, coreHash, profileHash } from '@prisma-next/contract/types';
import postgresDriver from '@prisma-next/driver-postgres/runtime';
import { instantiateExecutionStack } from '@prisma-next/framework-components/execution';
import { PostgresRuntimeImpl } from '@prisma-next/postgres/runtime';
import { sql } from '@prisma-next/sql-builder/runtime';
import { SqlStorage, StorageTable } from '@prisma-next/sql-contract/types';
import { createExecutionContext, createSqlExecutionStack } from '@prisma-next/sql-runtime';
import postgresTarget, { PostgresContractSerializer } from '@prisma-next/target-postgres/runtime';
import { PostgresSchema } from '@prisma-next/target-postgres/types';
import { timeouts, withDevDatabase } from '@repo/test-utils';
import { Pool } from 'pg';
import { describe, expect, it } from 'vitest';
import { createControlClientForTests, withE2eMigrationsDir } from './utils';

const postgresContractSerializer = new PostgresContractSerializer();

function buildMultiNamespaceRuntimeContract(): Contract<SqlStorage> {
  const userTable = {
    columns: {
      id: { nativeType: 'int4', codecId: 'pg/int4@1', nullable: false },
      name: { nativeType: 'text', codecId: 'pg/text@1', nullable: false },
    },
    primaryKey: { columns: ['id'] as const },
    uniques: [],
    indexes: [],
    foreignKeys: [],
  };

  const noteTable = {
    columns: {
      id: { nativeType: 'int4', codecId: 'pg/int4@1', nullable: false },
      body: { nativeType: 'text', codecId: 'pg/text@1', nullable: false },
      author_id: { nativeType: 'int4', codecId: 'pg/int4@1', nullable: false },
    },
    primaryKey: { columns: ['id'] as const },
    uniques: [],
    indexes: [],
    foreignKeys: [
      {
        source: {
          namespaceId: asNamespaceId('public'),
          tableName: 'note',
          columns: ['author_id'],
        },
        target: {
          namespaceId: asNamespaceId('auth'),
          tableName: 'user',
          columns: ['id'],
        },
        constraint: true,
        index: false,
      },
    ],
  };

  return {
    target: 'postgres',
    targetFamily: 'sql',
    profileHash: profileHash('multi-ns-runtime-e2e'),
    storage: new SqlStorage({
      storageHash: coreHash('multi-ns-runtime-e2e'),
      namespaces: {
        auth: new PostgresSchema({
          id: 'auth',
          entries: {
            table: { user: new StorageTable(userTable) },
          },
        }),
        public: new PostgresSchema({
          id: 'public',
          entries: {
            table: { note: new StorageTable(noteTable) },
          },
        }),
      },
    }),
    roots: {
      user: { model: 'User', namespace: asNamespaceId('auth') },
      note: { model: 'Note', namespace: asNamespaceId('public') },
    },
    domain: {
      namespaces: {
        auth: {
          models: {
            User: {
              fields: {
                id: { nullable: false, type: { kind: 'scalar', codecId: 'pg/int4@1' } },
                name: { nullable: false, type: { kind: 'scalar', codecId: 'pg/text@1' } },
              },
              relations: {},
              storage: {
                namespaceId: 'auth',
                table: 'user',
                fields: { id: { column: 'id' }, name: { column: 'name' } },
              },
            },
          },
        },
        public: {
          models: {
            Note: {
              fields: {
                id: { nullable: false, type: { kind: 'scalar', codecId: 'pg/int4@1' } },
                body: { nullable: false, type: { kind: 'scalar', codecId: 'pg/text@1' } },
                authorId: { nullable: false, type: { kind: 'scalar', codecId: 'pg/int4@1' } },
              },
              relations: {
                author: {
                  cardinality: 'N:1',
                  on: { localFields: ['authorId'], targetFields: ['id'] },
                  to: { model: 'User', namespace: 'auth' },
                },
              },
              storage: {
                namespaceId: 'public',
                table: 'note',
                fields: {
                  id: { column: 'id' },
                  body: { column: 'body' },
                  authorId: { column: 'author_id' },
                },
              },
            },
          },
        },
      },
    },
    capabilities: {},
    extensions: {},
    meta: {},
  } as unknown as Contract<SqlStorage>;
}

describe('multi-namespace runtime', () => {
  it(
    'applies auth + public schemas and queries each namespace with qualified SQL',
    async () => {
      const contract = buildMultiNamespaceRuntimeContract();
      const contractJson = postgresContractSerializer.serializeContract(contract);

      await withDevDatabase(async ({ connectionString }) => {
        const controlClient = createControlClientForTests(connectionString);
        try {
          await withE2eMigrationsDir(async (migrationsDir) => {
            const init = await controlClient.dbInit({
              contract: contractJson,
              mode: 'apply',
              migrationsDir,
            });
            if (!init.ok) {
              throw new Error(`dbInit failed: ${init.failure.summary}`);
            }
          });
        } finally {
          await controlClient.close();
        }

        const stack = createSqlExecutionStack({
          target: postgresTarget,
          adapter: postgresAdapter,
          driver: postgresDriver,
        });
        const context = createExecutionContext({ contract, stack });
        const stackInstance = instantiateExecutionStack(stack);
        const adapter = stackInstance.adapter;
        if (!adapter) {
          throw new Error('adapter missing from execution stack');
        }

        const pool = new Pool({ connectionString });
        try {
          const driver = postgresDriver.create();
          await driver.connect({ kind: 'pgPool', pool });

          const runtime = new PostgresRuntimeImpl({
            context,
            adapter: stackInstance.adapter,
            driver,
          });

          const db = sql({
            context,
            rawCodecInferer: postgresRawCodecInferer,
          });

          // Seed with qualified DDL targets (migration already created auth + public tables).
          await pool.query('INSERT INTO "auth"."user" (id, name) VALUES ($1, $2)', [1, 'Ada']);
          await pool.query(
            'INSERT INTO "public"."note" (id, body, author_id) VALUES ($1, $2, $3)',
            [10, 'hello', 1],
          );

          const userSelect = db['auth']!['user']!.select('id', 'name').build();
          const userSql = adapter.lower(userSelect.ast, {
            contract,
            params: userSelect.params,
          }).sql;
          expect(userSql).toContain('FROM "auth"."user"');

          const noteSelect = db['public']!['note']!.select('id', 'body').build();
          const noteSql = adapter.lower(noteSelect.ast, {
            contract,
            params: noteSelect.params,
          }).sql;
          expect(noteSql).toContain('FROM "public"."note"');

          expect([...(await runtime.execute(userSelect))]).toEqual([{ id: 1, name: 'Ada' }]);
          expect([...(await runtime.execute(noteSelect))]).toEqual([{ id: 10, body: 'hello' }]);
        } finally {
          await pool.end();
        }
      });
    },
    timeouts.spinUpPpgDev,
  );
});
