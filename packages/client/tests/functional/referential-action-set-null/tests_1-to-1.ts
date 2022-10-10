import { setupMSSQL } from '../../../src/utils/setupMSSQL'
import type { ProviderFlavor } from './_matrix'
import testMatrix from './_matrix'
import * as mssql from './_utils/mssql'
import * as mysql from './_utils/mysql'
import * as postgres from './_utils/postgres'
import type { SetupParams } from './_utils/types'

// @ts-ignore
const describeIf = (condition: boolean) => (condition ? describe : describe.skip)

// @ts-ignore
const testIf = (condition: boolean) => (condition ? test : test.skip)

function getDatabaseURL(providerFlavor: ProviderFlavor) {
  switch (providerFlavor) {
    case 'mssql':
      return 'mssql://SA:Pr1sm4_Pr1sm4@localhost:1433/PRISMA_DB_NAME'
    default: {
      const databaseURLKey = `TEST_FUNCTIONAL_${providerFlavor.toLocaleUpperCase()}_URI`
      const databaseURL = process.env[databaseURLKey]!
      return databaseURL
    }
  }
}

// the tests defined here are expected to run in sequence
testMatrix.setupTestSuite(
  (suiteConfig, suiteMeta) => {
    const { providerFlavor } = suiteConfig

    const setupParams = {
      connectionString: getDatabaseURL(providerFlavor),
    }

    const dropQuery = `
      DROP TABLE IF EXISTS Profile;
      DROP TABLE IF EXISTS SomeUser;
    `

    async function tearDown() {
      switch (providerFlavor) {
        case 'mysql':
          {
            await mysql.runAndForget(
              setupParams,
              `
              DROP TABLE IF EXISTS Profile;
              DROP TABLE IF EXISTS SomeUser;
            `,
            )
          }
          break
        case 'postgres':
        case 'cockroach':
          {
            await postgres.runAndForget(
              setupParams,
              `
              DROP TABLE IF EXISTS Profile;
              DROP TABLE IF EXISTS SomeUser;
            `,
            )
          }
          break
        case 'mssql':
          {
            await mssql.runAndForget(
              setupParams,
              `
              DROP TABLE IF EXISTS Profile;
              DROP TABLE IF EXISTS SomeUser;
            `,
            )
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
            userId INT NULL,
            UNIQUE INDEX Profile_userId_key (userId),
            PRIMARY KEY (id)
        );

        ALTER TABLE Profile ADD CONSTRAINT Profile_userId_fkey
          FOREIGN KEY (userId) REFERENCES SomeUser(id)
          ON DELETE SET NULL ON UPDATE SET NULL;
      `

      // postgresql, cockroachdb
      const createTablePostgres = `
        REVOKE CONNECT ON DATABASE PRISMA_DB_NAME FROM public;

        CREATE TABLE "SomeUser" (
          "id" INT NOT NULL,
          CONSTRAINT "SomeUser_pkey" PRIMARY KEY ("id")
        );
        
        CREATE TABLE "Profile" (
          "id" INT NOT NULL,
          "userId" INT NULL,
          CONSTRAINT "Profile_pkey" PRIMARY KEY ("id")
        );
        
        CREATE UNIQUE INDEX "Profile_userId_key" ON "Profile"("userId");
        
        ALTER TABLE "Profile" ADD CONSTRAINT "Profile_userId_fkey"
          FOREIGN KEY ("userId") REFERENCES "SomeUser"("id")
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
          [userId] INT NULL,
          CONSTRAINT [Profile_pkey] PRIMARY KEY CLUSTERED ([id]),
          CONSTRAINT [Profile_userId_key] UNIQUE NONCLUSTERED ([userId])
        );
        
        ALTER TABLE [dbo].[Profile] ADD CONSTRAINT [Profile_userId_fkey]
          FOREIGN KEY ([userId]) REFERENCES [dbo].[SomeUser]([id])
          ON DELETE SET NULL ON UPDATE SET NULL;
      `

      // queries for all databases
      const runnerQueries = {
        insert: `
          INSERT INTO SomeUser (id) VALUES (1);
          INSERT INTO SomeUser (id) VALUES (2);
                
          INSERT INTO Profile (id, userId) VALUES (1, 1);
          INSERT INTO Profile (id, userId) VALUES (2, 2);
        `,
        update: `
          UPDATE SomeUser
          SET id = 3
          WHERE id = 1;
        `,
        delete: `
          DELETE FROM SomeUser
          WHERE id = 2;
        `,
      }

      describe('insert + update + delete after SQL DDL', () => {
        async function setupMySQL() {
          await mysql.runAndForget(setupParams, createTableMySQL)
          const databaseRunner = await mysql.DatabaseRunner.new(setupParams, runnerQueries)
          return databaseRunner
        }

        async function setupPostgres() {
          await postgres.runAndForget(setupParams, createTablePostgres)
          const databaseRunner = await postgres.DatabaseRunner.new(setupParams, runnerQueries)
          return databaseRunner
        }

        async function setupMSSQL() {
          await mssql.runAndForget(setupParams, createTableSQLServer)
          const databaseRunner = await mssql.DatabaseRunner.new(setupParams, runnerQueries)
          return databaseRunner
        }

        async function setup() {
          switch (providerFlavor) {
            case 'mysql':
              return await setupMySQL()
            case 'postgres':
            case 'cockroach':
              return await setupPostgres()
            case 'mssql':
              return await setupMSSQL()
            default:
              throw new Error(`Unsupported provider flavor ${providerFlavor}!`)
          }
        }

        // TODO: 'cockroach' and 'postgres' throw with 'database "prisma_db_name" does not exist'
        testIf(['mysql'].includes(providerFlavor))(`succeeds with mysql`, async () => {
          const databaseRunner = await setup()
          await databaseRunner.insert()
          {
            const users = await databaseRunner.selectAllFrom('SomeUser')
            const profiles = await databaseRunner.selectAllFrom('Profile')

            expect(users).toMatchObject([{ id: 1 }, { id: 2 }])
            expect(profiles).toMatchObject([
              { id: 1, userId: 1 },
              { id: 2, userId: 2 },
            ])
          }

          await databaseRunner.update()
          {
            const users = await databaseRunner.selectAllFrom('SomeUser')
            const profiles = await databaseRunner.selectAllFrom('Profile')

            expect(users).toMatchObject([{ id: 2 }, { id: 3 }])
            expect(profiles).toMatchObject([
              { id: 1, userId: null },
              { id: 2, userId: 2 },
            ])
          }

          await databaseRunner.delete()
          {
            const users = await databaseRunner.selectAllFrom('SomeUser')
            const profiles = await databaseRunner.selectAllFrom('Profile')

            expect(users).toMatchObject([{ id: 3 }])
            expect(profiles).toMatchObject([
              { id: 1, userId: null },
              { id: 2, userId: null },
            ])
          }

          await databaseRunner.end()
          await tearDown()
        })

        testIf(['mssql'].includes(providerFlavor))(`fails with mssql due to NULL in unique`, async () => {
          await mssql.runAndForget(setupParams, createTableSQLServer)

          const databaseRunner = await mssql.DatabaseRunner.new(setupParams, runnerQueries)

          await databaseRunner.insert()
          {
            const users = await databaseRunner.selectAllFrom('SomeUser')
            const profiles = await databaseRunner.selectAllFrom('Profile')

            expect(users).toMatchObject([{ id: 1 }, { id: 2 }])
            expect(profiles).toMatchObject([
              { id: 1, userId: 1 },
              { id: 2, userId: 2 },
            ])
          }

          await databaseRunner.update()
          {
            const users = await databaseRunner.selectAllFrom('SomeUser')
            const profiles = await databaseRunner.selectAllFrom('Profile')

            expect(users).toMatchObject([{ id: 2 }, { id: 3 }])
            expect(profiles).toMatchObject([
              { id: 1, userId: null },
              { id: 2, userId: 2 },
            ])
          }

          try {
            await databaseRunner.delete()

            // check that this is unreachable, i.e. that an error was thrown
            expect(true).toBe(false)
          } catch (e) {
            expect(e.message).toMatchInlineSnapshot(
              `Violation of UNIQUE KEY constraint 'Profile_userId_key'. Cannot insert duplicate key in object 'dbo.Profile'. The duplicate key value is (<NULL>).`,
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
            userId INT NOT NULL,
            UNIQUE INDEX Profile_userId_key (userId),
            PRIMARY KEY (id)
        );

        ALTER TABLE Profile ADD CONSTRAINT Profile_userId_fkey
          FOREIGN KEY (userId) REFERENCES SomeUser(id)
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
          "userId" INT NOT NULL,
          CONSTRAINT "Profile_pkey" PRIMARY KEY ("id")
        );
        
        CREATE UNIQUE INDEX "Profile_userId_key" ON "Profile"("userId");
        
        ALTER TABLE "Profile" ADD CONSTRAINT "Profile_userId_fkey"
          FOREIGN KEY ("userId") REFERENCES "SomeUser"("id")
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
          [userId] INT NOT NULL,
          CONSTRAINT [Profile_pkey] PRIMARY KEY CLUSTERED ([id]),
          CONSTRAINT [Profile_userId_key] UNIQUE NONCLUSTERED ([userId])
        );
        
        ALTER TABLE [dbo].[Profile] ADD CONSTRAINT [Profile_userId_fkey]
          FOREIGN KEY ([userId]) REFERENCES [dbo].[SomeUser]([id])
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
              `Column 'userId' cannot be NOT NULL: needed in a foreign key constraint 'Profile_userId_fkey' SET NULL`,
            )
          }

          await tearDown()
        })

        /* postgresql */
        testIf(['postgres'].includes(providerFlavor))(`succeeds with ${providerFlavor}`, async () => {
          // we consider the fact that this succeeds is a Postgres bug
          await postgres.runAndForget(setupParams, createTablePostgres)

          await tearDown()
        })

        /* cockroachdb */
        testIf(['cockroach'].includes(providerFlavor))(`fails with ${providerFlavor}`, async () => {
          expect.assertions(1)

          try {
            await postgres.runAndForget(setupParams, createTablePostgres)
          } catch (e) {
            // fun fact: CockroachDB defines what we call "referential actions" as "cascading actions"
            expect(e.message).toContain(
              `cannot add a SET NULL cascading action on column "PRISMA_DB_NAME.public.Profile.userId" which has a NOT NULL constraint`,
            )
          }

          await tearDown()
        })

        /* sqlserver */
        testIf(['mssql'].includes(providerFlavor))(`fails with ${providerFlavor}`, async () => {
          expect.assertions(1)

          try {
            await mssql.runAndForget(setupParams, createTableSQLServer)
          } catch (e) {
            expect(e.message).toContain(`Could not create constraint or index. See previous errors.`)
          }

          await tearDown()
        })
      })
    })
  },
  {
    optOut: {
      from: ['sqlite', 'mongodb'],
      reason: "mongodb is not a SQL database, we don't have a sqlite driver installed yet",
    },
  },
)
