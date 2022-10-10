import testMatrix from './_matrix'
import { getDatabaseURL } from './_utils/getDatabaseURL'
import * as mssql from './_utils/mssql'
import * as mysql from './_utils/mysql'
import * as postgres from './_utils/postgres'
import { setup } from './_utils/setup'
import type { SetupParams } from './_utils/types'

// @ts-ignore
const describeIf = (condition: boolean) => (condition ? describe : describe.skip)

// @ts-ignore
const testIf = (condition: boolean) => (condition ? test : test.skip)

// the tests defined here are expected to run in sequence
testMatrix.setupTestSuite(
  (suiteConfig, suiteMeta) => {
    const { provider, providerFlavor } = suiteConfig

    const setupParams: SetupParams = {
      connectionString: getDatabaseURL(providerFlavor),
    }

    const UserTable = ['postgresql', 'cockroachdb'].includes(provider) ? '"SomeUser"' : 'SomeUser'

    const ProfileTable = ['postgresql', 'cockroachdb'].includes(provider) ? '"Profile"' : 'Profile'

    // queries for all databases
    const runnerQueries = {
      // valid for cockroach and postgres: INSERT INTO "SomeUser" ("id") VALUES (1);
      insert: `
        INSERT INTO ${UserTable} (id) VALUES (1);
        INSERT INTO ${UserTable} (id) VALUES (2);

        INSERT INTO ${ProfileTable} (id, user_id) VALUES (1, 1);
        INSERT INTO ${ProfileTable} (id, user_id) VALUES (2, 2);
      `,
      update: `
        UPDATE ${UserTable}
        SET id = 3
        WHERE id = 1;
      `,
      delete: `
        DELETE FROM ${UserTable}
        WHERE id = 2;
      `,
    }

    const dropQuery = `
      DROP TABLE IF EXISTS ${ProfileTable};
      DROP TABLE IF EXISTS ${UserTable};
    `

    async function tearDown() {
      switch (providerFlavor) {
        case 'mysql':
          {
            await mysql.runAndForget(setupParams, dropQuery)
          }
          break
        case 'postgres':
        case 'cockroach':
          {
            await postgres.runAndForget(setupParams, dropQuery)
          }
          break
        case 'mssql':
          {
            await mssql.runAndForget(setupParams, dropQuery)
          }
          break
        default:
          throw new Error(`Unsupported provider flavor: ${providerFlavor}`)
      }
    }

    describe('1:1 NULL', () => {
      // mysql, mariadb
      const createTableMySQL = `
        CREATE TABLE SomeUser (
          id INT NOT NULL,
          PRIMARY KEY (id)
        );
        
        CREATE TABLE Profile (
            id INT NOT NULL,
            user_id INT NULL,
            UNIQUE INDEX Profile_user_id_key (user_id),
            PRIMARY KEY (id)
        );

        ALTER TABLE Profile ADD CONSTRAINT Profile_user_id_fkey
          FOREIGN KEY (user_id) REFERENCES SomeUser(id)
          ON DELETE SET NULL ON UPDATE SET NULL;
      `

      // postgresql, cockroachdb
      const createTablePostgres = `
        CREATE TABLE "SomeUser" (
          "id" INT NOT NULL,
          CONSTRAINT "SomeUser_pkey" PRIMARY KEY ("id")
        );
        
        CREATE TABLE "Profile" (
          "id" INT NOT NULL,
          "user_id" INT NULL,
          CONSTRAINT "Profile_pkey" PRIMARY KEY ("id")
        );
        
        CREATE UNIQUE INDEX "Profile_user_id_key" ON "Profile"("user_id");
        
        ALTER TABLE "Profile" ADD CONSTRAINT "Profile_user_id_fkey"
          FOREIGN KEY ("user_id") REFERENCES "SomeUser"("id")
          ON DELETE SET NULL ON UPDATE SET NULL;
      `

      // sqlserver
      const createTableSQLServer = `
        CREATE TABLE [dbo].[SomeUser] (
          [id] INT NOT NULL,
          CONSTRAINT [SomeUser_pkey] PRIMARY KEY CLUSTERED ([id])
        );
        
        CREATE TABLE [dbo].[Profile] (
          [id] INT NOT NULL,
          [user_id] INT NULL,
          CONSTRAINT [Profile_pkey] PRIMARY KEY CLUSTERED ([id]),
          CONSTRAINT [Profile_user_id_key] UNIQUE NONCLUSTERED ([user_id])
        );
        
        ALTER TABLE [dbo].[Profile] ADD CONSTRAINT [Profile_user_id_fkey]
          FOREIGN KEY ([user_id]) REFERENCES [dbo].[SomeUser]([id])
          ON DELETE SET NULL ON UPDATE SET NULL;
      `

      describe('insert + update + delete after SQL DDL', () => {
        testIf(['mysql', 'postgres', 'cockroach'].includes(providerFlavor))(
          `succeeds with mysql, postgres, cockroach`,
          async () => {
            await tearDown()
            const databaseRunner = await setup({
              providerFlavor,
              setupParams,
              createTableStmts: {
                MySQL: createTableMySQL,
                Postgres: createTablePostgres,
                SQLServer: createTableSQLServer,
              },
              databaseRunnerQueries: runnerQueries,
            })

            await databaseRunner.insert()
            {
              const users = await databaseRunner.selectAllFrom(UserTable)
              const profiles = await databaseRunner.selectAllFrom(ProfileTable)

              expect(users).toMatchObject([{ id: 1 }, { id: 2 }])
              expect(profiles).toMatchObject([
                { id: 1, user_id: 1 },
                { id: 2, user_id: 2 },
              ])
            }

            await databaseRunner.update()
            {
              const users = await databaseRunner.selectAllFrom(UserTable)
              const profiles = await databaseRunner.selectAllFrom(ProfileTable)

              expect(users).toMatchObject([{ id: 2 }, { id: 3 }])
              expect(profiles).toMatchObject([
                { id: 1, user_id: null },
                { id: 2, user_id: 2 },
              ])
            }

            await databaseRunner.delete()
            {
              const users = await databaseRunner.selectAllFrom(UserTable)
              const profiles = await databaseRunner.selectAllFrom(ProfileTable)

              expect(users).toMatchObject([{ id: 3 }])
              expect(profiles).toMatchObject([
                { id: 1, user_id: null },
                { id: 2, user_id: null },
              ])
            }

            await databaseRunner.end()

            await tearDown()
          },
        )

        testIf(['mssql'].includes(providerFlavor))(`fails with mssql due to NULL in unique`, async () => {
          await mssql.runAndForget(setupParams, createTableSQLServer)

          const databaseRunner = await mssql.DatabaseRunner.new(setupParams, runnerQueries)

          await databaseRunner.insert()
          {
            const users = await databaseRunner.selectAllFrom('SomeUser')
            const profiles = await databaseRunner.selectAllFrom('Profile')

            expect(users).toMatchObject([{ id: 1 }, { id: 2 }])
            expect(profiles).toMatchObject([
              { id: 1, user_id: 1 },
              { id: 2, user_id: 2 },
            ])
          }

          await databaseRunner.update()
          {
            const users = await databaseRunner.selectAllFrom('SomeUser')
            const profiles = await databaseRunner.selectAllFrom('Profile')

            expect(users).toMatchObject([{ id: 2 }, { id: 3 }])
            expect(profiles).toMatchObject([
              { id: 1, user_id: null },
              { id: 2, user_id: 2 },
            ])
          }

          try {
            await databaseRunner.delete()

            // check that this is unreachable, i.e. that an error was thrown
            expect(true).toBe(false)
          } catch (e) {
            expect(e.message).toMatchInlineSnapshot(
              `Violation of UNIQUE KEY constraint 'Profile_user_id_key'. Cannot insert duplicate key in object 'dbo.Profile'. The duplicate key value is (<NULL>).`,
            )
          } finally {
            await databaseRunner.end()
            await tearDown()
          }
        })
      })
    })

    describe('1:1 NOT NULL', () => {
      // mysql, mariadb
      const createTableMySQL = `
        CREATE TABLE SomeUser (
          id INT NOT NULL,
          PRIMARY KEY (id)
        );
        
        CREATE TABLE Profile (
            id INT NOT NULL,
            user_id INT NOT NULL,
            UNIQUE INDEX Profile_user_id_key (user_id),
            PRIMARY KEY (id)
        );

        ALTER TABLE Profile ADD CONSTRAINT Profile_user_id_fkey
          FOREIGN KEY (user_id) REFERENCES SomeUser(id)
          ON DELETE SET NULL ON UPDATE SET NULL;
      `

      // postgresql, cockroachdb
      const createTablePostgres = `
        CREATE TABLE "SomeUser" (
          "id" INT NOT NULL,
          CONSTRAINT "SomeUser_pkey" PRIMARY KEY ("id")
        );
        
        CREATE TABLE "Profile" (
          "id" INT NOT NULL,
          "user_id" INT NOT NULL,
          CONSTRAINT "Profile_pkey" PRIMARY KEY ("id")
        );
        
        CREATE UNIQUE INDEX "Profile_user_id_key" ON "Profile"("user_id");
        
        ALTER TABLE "Profile" ADD CONSTRAINT "Profile_user_id_fkey"
          FOREIGN KEY ("user_id") REFERENCES "SomeUser"("id")
          ON DELETE SET NULL ON UPDATE SET NULL;
      `

      // sqlserver
      const createTableSQLServer = `
        CREATE TABLE [dbo].[SomeUser] (
          [id] INT NOT NULL,
          CONSTRAINT [SomeUser_pkey] PRIMARY KEY CLUSTERED ([id])
        );
        
        CREATE TABLE [dbo].[Profile] (
          [id] INT NOT NULL,
          [user_id] INT NOT NULL,
          CONSTRAINT [Profile_pkey] PRIMARY KEY CLUSTERED ([id]),
          CONSTRAINT [Profile_user_id_key] UNIQUE NONCLUSTERED ([user_id])
        );
        
        ALTER TABLE [dbo].[Profile] ADD CONSTRAINT [Profile_user_id_fkey]
          FOREIGN KEY ([user_id]) REFERENCES [dbo].[SomeUser]([id])
          ON DELETE SET NULL ON UPDATE SET NULL;
      `

      describe('create table', () => {
        /* mysql flavors */
        testIf(['mysql'].includes(providerFlavor))(`fails with mysql`, async () => {
          expect.assertions(1)

          try {
            await mysql.runAndForget(setupParams, createTableMySQL)
          } catch (e) {
            expect(e.message).toContain(
              `Column 'user_id' cannot be NOT NULL: needed in a foreign key constraint 'Profile_user_id_fkey' SET NULL`,
            )
          }

          await tearDown()
        })

        /* postgresql */
        testIf(['postgres'].includes(providerFlavor))(`succeeds with postgres, but it's a Postgres "bug"`, async () => {
          // we consider the fact that this succeeds is a Postgres bug
          await postgres.runAndForget(setupParams, createTablePostgres)

          await tearDown()
        })

        /* cockroachdb */
        testIf(['cockroach'].includes(providerFlavor))(`fails with cockroach`, async () => {
          expect.assertions(1)

          try {
            await postgres.runAndForget(setupParams, createTablePostgres)
          } catch (e) {
            // fun fact: CockroachDB defines what we call "referential actions" as "cascading actions"
            expect(e.message).toContain(
              `cannot add a SET NULL cascading action on column "PRISMA_DB_NAME.public.Profile.user_id" which has a NOT NULL constraint`,
            )
          }

          await tearDown()
        })

        /* sqlserver */
        testIf(['mssql'].includes(providerFlavor))(`fails with mssql`, async () => {
          expect.assertions(1)

          try {
            await mssql.runAndForget(setupParams, createTableSQLServer)
          } catch (e) {
            expect(e.message).toContain(`Could not create constraint or index. See previous errors.`)
          }

          await tearDown()
        })
      })

      describe('insert + update + delete after SQL DDL', () => {
        // although creating a 1:1 NOT NULL relation with SET NULL as a referential action
        // works in Postgres, triggering the action at runtime fails as it violates
        // a not-null constraint
        testIf(['postgres'].includes(providerFlavor))(
          'fails on postgres due to not-null constraint violation',
          async () => {
            await postgres.runAndForget(setupParams, createTablePostgres)
            const databaseRunner = await postgres.DatabaseRunner.new(setupParams, runnerQueries)

            await databaseRunner.insert()
            {
              const users = await databaseRunner.selectAllFrom(UserTable)
              const profiles = await databaseRunner.selectAllFrom(ProfileTable)

              expect(users).toMatchObject([{ id: 1 }, { id: 2 }])
              expect(profiles).toMatchObject([
                { id: 1, user_id: 1 },
                { id: 2, user_id: 2 },
              ])
            }

            try {
              await databaseRunner.update()

              // check that this is unreachable, i.e. that an error was thrown
              expect(true).toBe(false)
            } catch (e) {
              expect(e.message).toContain(`null value in column "user_id" violates not-null constraint`)
            } finally {
              await databaseRunner.end()
              await tearDown()
            }
          },
        )
      })
    })

    describe('1:1 compound mixed', () => {
      // mysql, mariadb
      const createTableMySQL = `
        CREATE TABLE SomeUser (
          id INTEGER NOT NULL,
          ref INTEGER NOT NULL,
          UNIQUE INDEX SomeUser_id_ref_key(id, ref),
          PRIMARY KEY (id)
        );
        
        CREATE TABLE Profile (
          id INTEGER NOT NULL,
          user_id INTEGER NULL,
          user_ref INTEGER NOT NULL,
          UNIQUE INDEX Profile_user_id_user_ref_key(user_id, user_ref),
          PRIMARY KEY (id)
        );
        
        ALTER TABLE Profile ADD CONSTRAINT Profile_user_id_user_ref_fkey
          FOREIGN KEY (user_id, user_ref) REFERENCES SomeUser(id, ref)
          ON DELETE SET NULL ON UPDATE SET NULL;
      `

      // postgresql, cockroachdb
      const createTablePostgres = `
        CREATE TABLE "SomeUser" (
          "id" INT NOT NULL,
          "ref" INT NOT NULL,
          CONSTRAINT "SomeUser_pkey" PRIMARY KEY ("id")
        );
        
        CREATE TABLE "Profile" (
          "id" INT NOT NULL,
          "user_id" INT NULL,
          "user_ref" INT NOT NULL,
          CONSTRAINT "Profile_pkey" PRIMARY KEY ("id")
        );
      
        CREATE UNIQUE INDEX "SomeUser_id_ref_key" ON "SomeUser"("id", "ref");
      
        CREATE UNIQUE INDEX "Profile_user_id_user_ref_key" ON "Profile"("user_id", "user_ref");
      
        ALTER TABLE "Profile" ADD CONSTRAINT "Profile_user_id_user_ref_fkey"
          FOREIGN KEY ("user_id", "user_ref") REFERENCES "SomeUser"("id", "ref")
          ON DELETE SET NULL ON UPDATE SET NULL;
      `

      // sqlserver
      const createTableSQLServer = `
        CREATE TABLE [dbo].[SomeUser] (
          [id] INT NOT NULL,
          [ref] INT NOT NULL,
          CONSTRAINT [SomeUser_pkey] PRIMARY KEY CLUSTERED ([id]),
          CONSTRAINT [SomeUser_id_ref_key] UNIQUE NONCLUSTERED ([id],[ref])
        );
        
        CREATE TABLE [dbo].[Profile] (
          [id] INT NOT NULL,
          [user_id] INT,
          [user_ref] INT NOT NULL,
          CONSTRAINT [Profile_pkey] PRIMARY KEY CLUSTERED ([id]),
          CONSTRAINT [Profile_user_id_user_ref_key] UNIQUE NONCLUSTERED ([user_id],[user_ref])
        );
        
        ALTER TABLE [dbo].[Profile] ADD CONSTRAINT [Profile_user_id_user_ref_fkey]
          FOREIGN KEY ([user_id], [user_ref]) REFERENCES [dbo].[SomeUser]([id],[ref])
          ON DELETE SET NULL ON UPDATE SET NULL;
      `

      describe('create table', () => {
        /* mysql flavors */
        testIf(['mysql'].includes(providerFlavor))(`fails with mysql`, async () => {
          expect.assertions(1)

          try {
            await mysql.runAndForget(setupParams, createTableMySQL)
          } catch (e) {
            expect(e.message).toContain(
              `Column 'user_ref' cannot be NOT NULL: needed in a foreign key constraint 'Profile_user_id_user_ref_fkey' SET NULL`,
            )
          }

          await tearDown()
        })

        /* postgresql */
        testIf(['postgres'].includes(providerFlavor))(`succeeds with postgres, but it's a Postgres "bug"`, async () => {
          // we consider the fact that this succeeds is a Postgres bug
          await postgres.runAndForget(setupParams, createTablePostgres)

          await tearDown()
        })

        /* cockroachdb */
        testIf(['cockroach'].includes(providerFlavor))(`fails with cockroach`, async () => {
          expect.assertions(1)

          try {
            await postgres.runAndForget(setupParams, createTablePostgres)
          } catch (e) {
            expect(e.message).toContain(
              `cannot add a SET NULL cascading action on column "PRISMA_DB_NAME.public.Profile.user_ref" which has a NOT NULL constraint`,
            )
          }

          await tearDown()
        })

        /* sqlserver */
        testIf(['mssql'].includes(providerFlavor))(`fails with mssql`, async () => {
          expect.assertions(1)

          try {
            await mssql.runAndForget(setupParams, createTableSQLServer)
          } catch (e) {
            expect(e.message).toContain(`Could not create constraint or index. See previous errors.`)
          }

          await tearDown()
        })
      })

      describe('insert + update + delete after SQL DDL', () => {
        // queries for all databases
        const runnerQueries = {
          insert: `
            INSERT INTO ${UserTable} (id, ref) VALUES (1, 2022);
            INSERT INTO ${UserTable} (id, ref) VALUES (2, 2022);

            INSERT INTO ${ProfileTable} (id, user_id, user_ref) VALUES (1, 1, 2022);
            INSERT INTO ${ProfileTable} (id, user_id, user_ref) VALUES (2, 2, 2022);
          `,
          update: `
            UPDATE ${UserTable}
            SET id = 3
            WHERE id = 1;
          `,
          delete: `
            DELETE FROM ${UserTable}
            WHERE id = 2;
          `,
        }

        // although creating a 1:1 NOT NULL relation with SET NULL as a referential action
        // works in Postgres, triggering the action at runtime fails as it violates
        // a not-null constraint
        testIf(['postgres'].includes(providerFlavor))(
          'fails on postgres due to not-null constraint violation',
          async () => {
            await postgres.runAndForget(setupParams, createTablePostgres)
            const databaseRunner = await postgres.DatabaseRunner.new(setupParams, runnerQueries)

            await databaseRunner.insert()
            {
              const users = await databaseRunner.selectAllFrom(UserTable)
              const profiles = await databaseRunner.selectAllFrom(ProfileTable)

              expect(users).toMatchObject([
                { id: 1, ref: 2022 },
                { id: 2, ref: 2022 },
              ])
              expect(profiles).toMatchObject([
                { id: 1, user_id: 1, user_ref: 2022 },
                { id: 2, user_id: 2, user_ref: 2022 },
              ])
            }

            try {
              await databaseRunner.update()

              // check that this is unreachable, i.e. that an error was thrown
              expect(true).toBe(false)
            } catch (e) {
              expect(e.message).toContain(`null value in column "user_ref" violates not-null constraint`)
            } finally {
              await databaseRunner.end()
              await tearDown()
            }
          },
        )
      })
    })
  },
  {
    optOut: {
      from: ['sqlite', 'mongodb', 'sqlserver', 'cockroachdb'],
      reason:
        "mongodb is not a SQL database, we don't have a sqlite driver installed yet, sqlserver and cockroachdb aren't available on no-docker CI",
    },
  },
)
