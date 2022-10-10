import type { ProviderFlavor } from './_matrix'
import testMatrix from './_matrix'
import * as mssql from './_utils/mssql'
import * as mysql from './_utils/mysql'
import * as postgres from './_utils/postgres'

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

testMatrix.setupTestSuite(
  (suiteConfig, suiteMeta) => {
    const { providerFlavor } = suiteConfig
    const databaseURL = getDatabaseURL(providerFlavor)

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
          const setupParams: mysql.SetupParams = {
            connectionString: databaseURL,
          }

          try {
            await mysql.createTable(setupParams, createTableMySQL)
          } catch (e) {
            expect(e.message).toContain(
              `Column 'userId' cannot be NOT NULL: needed in a foreign key constraint 'Profile_userId_fkey' SET NULL`,
            )
          }
        })

        testIf(['mariadb'].includes(providerFlavor))(`fails with mariadb`, async () => {
          expect.assertions(1)
          const setupParams: mysql.SetupParams = {
            connectionString: databaseURL,
          }

          try {
            await mysql.createTable(setupParams, createTableMySQL)
          } catch (e) {
            expect(e.message).toContain(
              `Can't create table \`PRISMA_DB_NAME\`.\`Profile\` (errno: 150 "Foreign key constraint is incorrectly formed")`,
            )
          }
        })

        /* postgresql */
        testIf(['postgres'].includes(providerFlavor))(`succeeds with ${providerFlavor}`, async () => {
          const setupParams: postgres.SetupParams = {
            connectionString: databaseURL,
          }

          // we consider the fact that this succeeds is a Postgres bug
          await postgres.createTable(setupParams, createTablePostgres)
        })

        /* cockroachdb */
        testIf(['cockroach'].includes(providerFlavor))(`fails with ${providerFlavor}`, async () => {
          expect.assertions(1)
          const setupParams: postgres.SetupParams = {
            connectionString: databaseURL,
          }

          try {
            await postgres.createTable(setupParams, createTablePostgres)
          } catch (e) {
            // fun fact: CockroachDB defines what we call "referential actions" as "cascading actions"
            expect(e.message).toContain(
              `cannot add a SET NULL cascading action on column "PRISMA_DB_NAME.public.Profile.userId" which has a NOT NULL constraint`,
            )
          }
        })

        /* sqlserver */
        testIf(['mssql'].includes(providerFlavor))(`fails with ${providerFlavor}`, async () => {
          expect.assertions(1)
          const setupParams: mssql.SetupParams = {
            connectionString: databaseURL,
          }

          try {
            await mssql.createTable(setupParams, createTableSQLServer)
          } catch (e) {
            expect(e.message).toContain(`Could not create constraint or index. See previous errors.`)
          }
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
