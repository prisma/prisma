import { int4Column, textColumn } from '@internal/adapter-postgres/column-types';
import postgresAdapter from '@internal/adapter-postgres/control';
import type { Contract } from '@internal/contract/types';
import postgresDriver from '@internal/driver-postgres/control';
import sql from '@internal/family-sql/control';
import type { TargetBoundComponentDescriptor } from '@internal/framework-components/components';
import { createControlStack } from '@internal/framework-components/control';
import { defineContract, field, model } from '@internal/postgres/contract-builder';
import type { SqlStorage } from '@internal/sql-contract/types';
import postgres from '@internal/target-postgres/control';
import { PostgresContractSerializer } from '@internal/target-postgres/runtime';
import { createDevDatabase, timeouts, withClient } from '@repo/test-utils';
import { beforeAll, beforeEach, describe, expect, it } from 'vitest';

describe('family instance schemaVerify', () => {
  let connectionString: string | undefined;

  beforeAll(async () => {
    const database = await createDevDatabase();
    connectionString = database.connectionString;
    return async () => {
      await database.close();
    };
  }, timeouts.spinUpPpgDev);

  describe('happy path: schema matches contract', () => {
    beforeEach(async () => {
      if (!connectionString) {
        throw new Error('Connection string not set');
      }
      await withClient(connectionString, async (client) => {
        await client.query('DROP TABLE IF EXISTS "post"');
        await client.query('DROP TABLE IF EXISTS "user"');
        await client.query(`
          CREATE TABLE "user" (
            id SERIAL PRIMARY KEY,
            email TEXT NOT NULL,
            CONSTRAINT "user_email_unique" UNIQUE (email)
          )
        `);
        await client.query(`
          CREATE TABLE "post" (
            id SERIAL PRIMARY KEY,
            "userId" INTEGER NOT NULL,
            title TEXT NOT NULL,
            FOREIGN KEY ("userId") REFERENCES "user"(id)
          )
        `);
        await client.query('CREATE INDEX "post_userId_idx_a489d58a" ON "post"("userId")');
      });
    }, timeouts.spinUpPpgDev);

    it(
      'returns ok=true with all pass nodes',
      async () => {
        if (!connectionString) {
          throw new Error('Connection string not set');
        }

        const User = model('User', {
          fields: {
            id: field.column(int4Column).id(),
            email: field.column(textColumn).unique(),
          },
        }).sql({ table: 'user' });

        const Post = model('Post', {
          fields: {
            id: field.column(int4Column).id(),
            userId: field.column(int4Column),
            title: field.column(textColumn),
          },
        }).sql(({ cols, constraints }) => ({
          table: 'post',
          indexes: [constraints.index([cols.userId])],
          foreignKeys: [constraints.foreignKey(cols.userId, User.refs.id)],
        }));

        const contract = defineContract({
          models: { User, Post },
        });

        const driver = await postgresDriver.create(connectionString);
        try {
          const familyInstance = sql.create(
            createControlStack({
              family: sql,
              target: postgres,
              adapter: postgresAdapter,
              driver: postgresDriver,
              extensions: [],
            }),
          );

          const validatedContract = new PostgresContractSerializer().deserializeContract(
            contract,
          ) as Contract<SqlStorage>;
          const frameworkComponents: ReadonlyArray<
            TargetBoundComponentDescriptor<'sql', 'postgres'>
          > = [postgres, postgresAdapter];
          const schema = await familyInstance.introspect({
            driver,
            contract: validatedContract,
          });
          const result = familyInstance.verifySchema({
            contract: validatedContract,
            schema,
            strict: false,
            frameworkComponents,
          });

          expect(result.ok).toBe(true);
          expect(result.schema.issues).toEqual([]);
        } finally {
          await driver.close();
        }
      },
      timeouts.spinUpPpgDev,
    );
  });

  describe('missing table', () => {
    beforeEach(async () => {
      if (!connectionString) {
        throw new Error('Connection string not set');
      }
      await withClient(connectionString, async (client) => {
        await client.query('DROP TABLE IF EXISTS "post"');
        await client.query('DROP TABLE IF EXISTS "user"');
        await client.query(`
          CREATE TABLE "user" (
            id SERIAL PRIMARY KEY,
            email TEXT NOT NULL
          )
        `);
      });
    }, timeouts.spinUpPpgDev);

    it(
      'returns ok=false with missing_table issue',
      async () => {
        if (!connectionString) {
          throw new Error('Connection string not set');
        }

        const contract = defineContract({
          models: {
            User: model('User', {
              fields: {
                id: field.column(int4Column).id(),
                email: field.column(textColumn),
              },
            }).sql({ table: 'user' }),
            Post: model('Post', {
              fields: {
                id: field.column(int4Column).id(),
                title: field.column(textColumn),
              },
            }).sql({ table: 'post' }),
          },
        });

        const driver = await postgresDriver.create(connectionString);
        try {
          const familyInstance = sql.create(
            createControlStack({
              family: sql,
              target: postgres,
              adapter: postgresAdapter,
              driver: postgresDriver,
              extensions: [],
            }),
          );

          const validatedContract = new PostgresContractSerializer().deserializeContract(
            contract,
          ) as Contract<SqlStorage>;
          const frameworkComponents: ReadonlyArray<
            TargetBoundComponentDescriptor<'sql', 'postgres'>
          > = [postgres, postgresAdapter];
          const schema = await familyInstance.introspect({
            driver,
            contract: validatedContract,
          });
          const result = familyInstance.verifySchema({
            contract: validatedContract,
            schema,
            strict: false,
            frameworkComponents,
          });

          expect(result.ok).toBe(false);
          expect(result.schema.issues).toContainEqual(
            expect.objectContaining({ path: ['database', 'public', 'post'] }),
          );
        } finally {
          await driver.close();
        }
      },
      timeouts.spinUpPpgDev,
    );
  });

  describe('missing column', () => {
    beforeEach(async () => {
      if (!connectionString) {
        throw new Error('Connection string not set');
      }
      await withClient(connectionString, async (client) => {
        await client.query('DROP TABLE IF EXISTS "user"');
        await client.query(`
          CREATE TABLE "user" (
            id SERIAL PRIMARY KEY
          )
        `);
      });
    }, timeouts.spinUpPpgDev);

    it(
      'returns ok=false with missing_column issue',
      async () => {
        if (!connectionString) {
          throw new Error('Connection string not set');
        }

        const contract = defineContract({
          models: {
            User: model('User', {
              fields: {
                id: field.column(int4Column).id(),
                email: field.column(textColumn),
              },
            }).sql({ table: 'user' }),
          },
        });

        const driver = await postgresDriver.create(connectionString);
        try {
          const familyInstance = sql.create(
            createControlStack({
              family: sql,
              target: postgres,
              adapter: postgresAdapter,
              driver: postgresDriver,
              extensions: [],
            }),
          );

          const validatedContract = new PostgresContractSerializer().deserializeContract(
            contract,
          ) as Contract<SqlStorage>;
          const frameworkComponents: ReadonlyArray<
            TargetBoundComponentDescriptor<'sql', 'postgres'>
          > = [postgres, postgresAdapter];
          const schema = await familyInstance.introspect({
            driver,
            contract: validatedContract,
          });
          const result = familyInstance.verifySchema({
            contract: validatedContract,
            schema,
            strict: false,
            frameworkComponents,
          });

          expect(result.ok).toBe(false);
          expect(result.schema.issues).toContainEqual(
            expect.objectContaining({
              path: ['database', 'public', 'user', 'column:email'],
            }),
          );
        } finally {
          await driver.close();
        }
      },
      timeouts.spinUpPpgDev,
    );
  });
});
