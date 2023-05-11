// describeIf is making eslint unhappy about the test names
/* eslint-disable jest/no-identical-title */

import { jestConsoleContext, jestContext, jestProcessContext } from '@prisma/get-platform'
import path from 'path'

import { DbPull } from '../../commands/DbPull'
import { SetupParams, setupPostgres, tearDownPostgres } from '../../utils/setupPostgres'

const isMacOrWindowsCI = Boolean(process.env.CI) && ['darwin', 'win32'].includes(process.platform)
if (isMacOrWindowsCI) {
  jest.setTimeout(60_000)
}

const ctx = jestContext.new().add(jestConsoleContext()).add(jestProcessContext()).assemble()

// To avoid the loading spinner locally
process.env.CI = 'true'

const originalEnv = { ...process.env }

describe('postgresql - missing database', () => {
  const defaultConnectionString =
    process.env.TEST_POSTGRES_URI_MIGRATE || 'postgres://prisma:prisma@localhost:5432/tests-migrate'

  // replace database name, e.g., 'tests-migrate', with 'unknown-database'
  const connectionString = defaultConnectionString.split('/').slice(0, -1).join('/') + '/unknown-database'

  test('basic introspection --url', async () => {
    const introspect = new DbPull()
    const result = introspect.parse(['--print', '--url', connectionString])
    await expect(result).rejects.toThrowErrorMatchingInlineSnapshot(`

      P1003 The introspected database does not exist: postgres://prisma:prisma@localhost:5432/unknown-database

      prisma db pull could not create any models in your schema.prisma file and you will not be able to generate Prisma Client with the prisma generate command.

      To fix this, you have two options:

      - manually create a database.
      - make sure the database connection URL inside the datasource block in schema.prisma points to an existing database.

      Then you can run prisma db pull again. 

    `)
    expect(ctx.mocked['console.log'].mock.calls.join('\n')).toMatchInlineSnapshot(``)
    expect(ctx.mocked['console.info'].mock.calls.join('\n')).toMatchInlineSnapshot(``)
    expect(ctx.mocked['console.error'].mock.calls.join('\n')).toMatchInlineSnapshot(``)
    expect(ctx.mocked['process.stdout.write'].mock.calls.join('\n')).toMatchInlineSnapshot(``)
    expect(ctx.mocked['process.stderr.write'].mock.calls.join('\n')).toMatchInlineSnapshot(``)
  })
})

describe('postgresql introspection stopgaps', () => {
  const connectionString = process.env.TEST_POSTGRES_URI_MIGRATE!.replace(
    'tests-migrate',
    'tests-migrate-db-pull-postgresql',
  )

  const computeSetupParams = (stopGap: string, warningCode: number, variant?: number): SetupParams => {
    const setupParams: SetupParams = {
      connectionString,
      // Note: dirname points to a location with a setup.sql file
      // which will be executed to prepare the database with the correct tables, views etc.
      dirname: path.join(
        __dirname,
        '..',
        '..',
        '__tests__',
        'fixtures',
        'introspection',
        'postgresql',
        `${stopGap}-warning-${warningCode}${variant ? `-${variant}` : ''}`,
      ),
    }
    return setupParams
  }

  const setupPostgresForWarning = (stopGap: string, warningCode: number, variant?: number) => {
    const setupParams = computeSetupParams(stopGap, warningCode, variant)

    beforeEach(async () => {
      await setupPostgres(setupParams)

      // Back to original env vars
      process.env = { ...originalEnv }
      // Update env var because it's the one that is used in the schemas tested
      process.env.TEST_POSTGRES_URI_MIGRATE = connectionString
    })

    afterEach(async () => {
      // Back to original env vars
      process.env = { ...originalEnv }
      await tearDownPostgres(setupParams).catch((e) => {
        console.error(e)
      })
    })
  }

  describe('warning 27 - partitioned tables found', () => {
    const stopGap = 'partitioned'
    const warningCode = 27

    describe('27/1 - single table found', () => {
      const variant = 1
      setupPostgresForWarning(stopGap, warningCode, variant)

      test('basic introspection', async () => {
        ctx.fixture(`introspection/postgresql/${stopGap}-warning-${warningCode}-${variant}`)
        const introspect = new DbPull()
        const result = introspect.parse(['--print'])

        await expect(result).resolves.toMatchInlineSnapshot(``)

        expect(ctx.mocked['console.log'].mock.calls.join('\n')).toMatchInlineSnapshot(`
          generator client {
            provider = "prisma-client-js"
          }

          datasource db {
            provider = "postgres"
            url      = env("TEST_POSTGRES_URI_MIGRATE")
          }

          /// This table is a partition table and requires additional setup for migrations. Visit https://pris.ly/d/partition-tables for more info.
          /// The underlying table does not contain a valid unique identifier and can therefore currently not be handled by the Prisma Client.
          model measurement {
            city_id   Int
            logdate   DateTime @db.Date
            peaktemp  Int?
            unitsales Int?

            @@ignore
          }


          // introspectionSchemaVersion: NonPrisma,
        `)
        expect(ctx.mocked['console.info'].mock.calls.join('\n')).toMatchInlineSnapshot(``)
        expect(ctx.mocked['console.error'].mock.calls.join('\n')).toMatchInlineSnapshot(`

                    // *** WARNING ***
                    // 
                    // The following models were ignored as they do not have a valid unique identifier or id. This is currently not supported by the Prisma Client:
                    //   - "measurement"
                    // 
                    // These tables are partition tables, which are not yet fully supported:
                    //   - "measurement"
                    // 
                `)
        expect(ctx.mocked['process.stdout.write'].mock.calls.join('\n')).toMatchInlineSnapshot(``)
        expect(ctx.mocked['process.stderr.write'].mock.calls.join('\n')).toMatchInlineSnapshot(``)
      })
    })

    describe('27/2 - multiple tables found', () => {
      const variant = 2
      setupPostgresForWarning(stopGap, warningCode, variant)

      test('basic introspection', async () => {
        ctx.fixture(`introspection/postgresql/${stopGap}-warning-${warningCode}-${variant}`)
        const introspect = new DbPull()
        const result = introspect.parse(['--print'])

        await expect(result).resolves.toMatchInlineSnapshot(``)

        expect(ctx.mocked['console.log'].mock.calls.join('\n')).toMatchInlineSnapshot(`
          generator client {
            provider = "prisma-client-js"
          }

          datasource db {
            provider = "postgres"
            url      = env("TEST_POSTGRES_URI_MIGRATE")
          }

          /// This table is a partition table and requires additional setup for migrations. Visit https://pris.ly/d/partition-tables for more info.
          /// The underlying table does not contain a valid unique identifier and can therefore currently not be handled by the Prisma Client.
          model definitely_not_measurement {
            city_id   Int
            logdate   DateTime @db.Date
            peaktemp  Int?
            unitsales Int?

            @@ignore
          }

          /// This table is a partition table and requires additional setup for migrations. Visit https://pris.ly/d/partition-tables for more info.
          /// The underlying table does not contain a valid unique identifier and can therefore currently not be handled by the Prisma Client.
          model measurement {
            city_id   Int
            logdate   DateTime @db.Date
            peaktemp  Int?
            unitsales Int?

            @@ignore
          }


          // introspectionSchemaVersion: NonPrisma,
        `)
        expect(ctx.mocked['console.info'].mock.calls.join('\n')).toMatchInlineSnapshot(``)
        expect(ctx.mocked['console.error'].mock.calls.join('\n')).toMatchInlineSnapshot(`

                    // *** WARNING ***
                    // 
                    // The following models were ignored as they do not have a valid unique identifier or id. This is currently not supported by the Prisma Client:
                    //   - "definitely_not_measurement"
                    //   - "measurement"
                    // 
                    // These tables are partition tables, which are not yet fully supported:
                    //   - "definitely_not_measurement"
                    //   - "measurement"
                    // 
                `)
        expect(ctx.mocked['process.stdout.write'].mock.calls.join('\n')).toMatchInlineSnapshot(``)
        expect(ctx.mocked['process.stderr.write'].mock.calls.join('\n')).toMatchInlineSnapshot(``)
      })
    })
  })

  describe('warning 29 - null sorted indices found', () => {
    const stopGap = 'null_sort'
    const warningCode = 29
    setupPostgresForWarning(stopGap, warningCode)

    test('basic introspection', async () => {
      ctx.fixture(`introspection/postgresql/${stopGap}-warning-${warningCode}`)
      const introspect = new DbPull()
      const result = introspect.parse(['--print'])

      await expect(result).resolves.toMatchInlineSnapshot(``)

      expect(ctx.mocked['console.log'].mock.calls.join('\n')).toMatchInlineSnapshot(`
        generator client {
          provider = "prisma-client-js"
        }

        datasource db {
          provider = "postgresql"
          url      = env("TEST_POSTGRES_URI_MIGRATE")
        }

        /// This model contains an index with non-default null sort order and requires additional setup for migrations. Visit https://pris.ly/d/default-index-null-ordering for more info.
        model foo {
          id Int @id
          a  Int
          b  Int @unique(map: "idx_b")

          @@index([a], map: "idx_a")
        }


        // introspectionSchemaVersion: NonPrisma,
      `)
      expect(ctx.mocked['console.info'].mock.calls.join('\n')).toMatchInlineSnapshot(``)
      expect(ctx.mocked['console.error'].mock.calls.join('\n')).toMatchInlineSnapshot(`

                // *** WARNING ***
                // 
                // These index columns are having a non-default null sort order, which is not yet fully supported. Read more: https://pris.ly/d/non-default-index-null-ordering
                //   - Index: "idx_a", column: "a"
                // 
            `)
      expect(ctx.mocked['process.stdout.write'].mock.calls.join('\n')).toMatchInlineSnapshot(``)
      expect(ctx.mocked['process.stderr.write'].mock.calls.join('\n')).toMatchInlineSnapshot(``)
    })
  })

  describe('warning 30 - row level security found', () => {
    const stopGap = 'row-level-security'
    const warningCode = 30
    setupPostgresForWarning(stopGap, warningCode)

    test('basic introspection', async () => {
      ctx.fixture(`introspection/postgresql/${stopGap}-warning-${warningCode}`)
      const introspect = new DbPull()
      const result = introspect.parse(['--print'])

      await expect(result).resolves.toMatchInlineSnapshot(``)

      expect(ctx.mocked['console.log'].mock.calls.join('\n')).toMatchInlineSnapshot(`
        generator client {
          provider = "prisma-client-js"
        }

        datasource db {
          provider = "postgres"
          url      = env("TEST_POSTGRES_URI_MIGRATE")
        }

        /// This model contains row level security and requires additional setup for migrations. Visit https://pris.ly/d/row-level-security for more info.
        model foo {
          id    Int    @id @default(autoincrement())
          owner String @db.VarChar(30)
        }


        // introspectionSchemaVersion: NonPrisma,
      `)
      expect(ctx.mocked['console.info'].mock.calls.join('\n')).toMatchInlineSnapshot(``)
      expect(ctx.mocked['console.error'].mock.calls.join('\n')).toMatchInlineSnapshot(`

                // *** WARNING ***
                // 
                // These tables contain row level security, which is not yet fully supported. Read more: https://pris.ly/d/row-level-security
                //   - "foo"
                // 
            `)
      expect(ctx.mocked['process.stdout.write'].mock.calls.join('\n')).toMatchInlineSnapshot(``)
      expect(ctx.mocked['process.stderr.write'].mock.calls.join('\n')).toMatchInlineSnapshot(``)
    })
  })

  describe('warning 35 - deferred constraint found', () => {
    const stopGap = 'deferred-constraint'
    const warningCode = 35
    setupPostgresForWarning(stopGap, warningCode)

    test('basic introspection', async () => {
      ctx.fixture(`introspection/postgresql/${stopGap}-warning-${warningCode}`)
      const introspect = new DbPull()
      const result = introspect.parse(['--print'])

      await expect(result).resolves.toMatchInlineSnapshot(``)

      expect(ctx.mocked['console.log'].mock.calls.join('\n')).toMatchInlineSnapshot(`
        generator client {
          provider = "prisma-client-js"
        }

        datasource db {
          provider = "postgresql"
          url      = env("TEST_POSTGRES_URI_MIGRATE")
        }

        /// This model has constraints using non-default deferring rules and requires additional setup for migrations. Visit https://pris.ly/d/constraint-deferring for more info.
        model a {
          id  Int  @id(map: "foo_pkey")
          foo Int? @unique(map: "foo_key")
          bar Int?
          b   b?   @relation(fields: [foo], references: [id], onDelete: NoAction, onUpdate: NoAction, map: "a_b_fk")
        }

        model b {
          id Int @id
          a  a?
        }


        // introspectionSchemaVersion: NonPrisma,
      `)
      expect(ctx.mocked['console.info'].mock.calls.join('\n')).toMatchInlineSnapshot(``)
      expect(ctx.mocked['console.error'].mock.calls.join('\n')).toMatchInlineSnapshot(`

                // *** WARNING ***
                // 
                // These primary key, foreign key or unique constraints are using non-default deferring in the database, which is not yet fully supported. Read more: https://pris.ly/d/constraint-deferring
                //   - Model: "a", constraint: "foo_key"
                //   - Model: "a", constraint: "foo_pkey"
                //   - Model: "a", constraint: "a_b_fk"
                // 
            `)
      expect(ctx.mocked['process.stdout.write'].mock.calls.join('\n')).toMatchInlineSnapshot(``)
      expect(ctx.mocked['process.stderr.write'].mock.calls.join('\n')).toMatchInlineSnapshot(``)
    })
  })

  describe('warning 36 - comments found', () => {
    const stopGap = 'comments'
    const warningCode = 36

    describe('36/1 - comments found: models & fields', () => {
      const variant = 1
      setupPostgresForWarning(stopGap, warningCode, variant)

      test('basic introspection', async () => {
        ctx.fixture(`introspection/postgresql/${stopGap}-warning-${warningCode}-${variant}`)
        const introspect = new DbPull()
        const result = introspect.parse(['--print'])

        await expect(result).resolves.toMatchInlineSnapshot(``)

        expect(ctx.mocked['console.log'].mock.calls.join('\n')).toMatchInlineSnapshot(`
          generator client {
            provider = "prisma-client-js"
          }

          datasource db {
            provider = "postgres"
            url      = env("TEST_POSTGRES_URI_MIGRATE")
          }

          /// This model or at least one of its fields has comments in the database, and requires an additional setup for migrations: Read more: https://pris.ly/d/database-comments
          model a {
            id  Int     @id
            val String? @db.VarChar(20)
          }


          // introspectionSchemaVersion: NonPrisma,
        `)
        expect(ctx.mocked['console.info'].mock.calls.join('\n')).toMatchInlineSnapshot(``)
        expect(ctx.mocked['console.error'].mock.calls.join('\n')).toMatchInlineSnapshot(`

                    // *** WARNING ***
                    // 
                    // These objects have comments defined in the database, which is not yet fully supported. Read more: https://pris.ly/d/database-comments
                    //   - Type: "model", name: "a"
                    //   - Type: "field", name: "a.val"
                    // 
                `)
        expect(ctx.mocked['process.stdout.write'].mock.calls.join('\n')).toMatchInlineSnapshot(``)
        expect(ctx.mocked['process.stderr.write'].mock.calls.join('\n')).toMatchInlineSnapshot(``)
      })
    })

    describe('36/2 - comments found: views & fields', () => {
      const variant = 2
      setupPostgresForWarning(stopGap, warningCode, variant)

      test('basic introspection', async () => {
        ctx.fixture(`introspection/postgresql/${stopGap}-warning-${warningCode}-${variant}`)
        const introspect = new DbPull()
        const result = introspect.parse(['--print'])

        await expect(result).resolves.toMatchInlineSnapshot(``)

        expect(ctx.mocked['console.log'].mock.calls.join('\n')).toMatchInlineSnapshot(`
          generator client {
            provider        = "prisma-client-js"
            previewFeatures = ["views"]
          }

          datasource db {
            provider = "postgres"
            url      = env("TEST_POSTGRES_URI_MIGRATE")
          }

          model a {
            id  Int     @id
            val String? @db.VarChar(20)
          }

          /// The underlying view does not contain a valid unique identifier and can therefore currently not be handled by the Prisma Client.
          /// This view or at least one of its fields has comments in the database, and requires an additional setup for migrations: Read more: https://pris.ly/d/database-comments
          view b {
            val String? @db.VarChar(20)

            @@ignore
          }


          // introspectionSchemaVersion: NonPrisma,
        `)
        expect(ctx.mocked['console.info'].mock.calls.join('\n')).toMatchInlineSnapshot(``)
        expect(ctx.mocked['console.error'].mock.calls.join('\n')).toMatchInlineSnapshot(`

                    // *** WARNING ***
                    // 
                    // The following views were ignored as they do not have a valid unique identifier or id. This is currently not supported by the Prisma Client. Please refer to the documentation on defining unique identifiers in views: https://pris.ly/d/view-identifiers
                    //   - "b"
                    // 
                    // These objects have comments defined in the database, which is not yet fully supported. Read more: https://pris.ly/d/database-comments
                    //   - Type: "view", name: "b"
                    //   - Type: "field", name: "b.val"
                    // 
                `)
        expect(ctx.mocked['process.stdout.write'].mock.calls.join('\n')).toMatchInlineSnapshot(``)
        expect(ctx.mocked['process.stderr.write'].mock.calls.join('\n')).toMatchInlineSnapshot(``)
      })
    })

    describe('36/3 - comments found: enums', () => {
      const variant = 3
      setupPostgresForWarning(stopGap, warningCode, variant)

      test('basic introspection', async () => {
        ctx.fixture(`introspection/postgresql/${stopGap}-warning-${warningCode}-${variant}`)
        const introspect = new DbPull()
        const result = introspect.parse(['--print'])

        await expect(result).resolves.toMatchInlineSnapshot(``)

        expect(ctx.mocked['console.log'].mock.calls.join('\n')).toMatchInlineSnapshot(`
          generator client {
            provider = "prisma-client-js"
          }

          datasource db {
            provider = "postgres"
            url      = env("TEST_POSTGRES_URI_MIGRATE")
          }

          /// This enum is commented in the database, and requires an additional setup for migrations: Read more: https://pris.ly/d/database-comments
          enum c {
            a
            b
          }


          // introspectionSchemaVersion: NonPrisma,
        `)
        expect(ctx.mocked['console.info'].mock.calls.join('\n')).toMatchInlineSnapshot(``)
        expect(ctx.mocked['console.error'].mock.calls.join('\n')).toMatchInlineSnapshot(`

                    // *** WARNING ***
                    // 
                    // These objects have comments defined in the database, which is not yet fully supported. Read more: https://pris.ly/d/database-comments
                    //   - Type: "enum", name: "c"
                    // 
                `)
        expect(ctx.mocked['process.stdout.write'].mock.calls.join('\n')).toMatchInlineSnapshot(``)
        expect(ctx.mocked['process.stderr.write'].mock.calls.join('\n')).toMatchInlineSnapshot(``)
      })
    })
  })
})

describe('postgresql', () => {
  const connectionString = process.env.TEST_POSTGRES_URI_MIGRATE!.replace(
    'tests-migrate',
    'tests-migrate-db-pull-postgresql',
  )

  const setupParams: SetupParams = {
    connectionString,
    // Note: at this location there is a setup.sql file
    // which will be executed a SQL file so the database is not empty
    dirname: path.join(__dirname, '..', '..', '__tests__', 'fixtures', 'introspection', 'postgresql'),
  }

  beforeAll(async () => {
    await tearDownPostgres(setupParams).catch((e) => {
      console.error(e)
    })
  })

  beforeEach(async () => {
    await setupPostgres(setupParams).catch((e) => {
      console.error(e)
    })
    // Back to original env vars
    process.env = { ...originalEnv }
    // Update env var because it's the one that is used in the schemas tested
    process.env.TEST_POSTGRES_URI_MIGRATE = connectionString
  })

  afterEach(async () => {
    // Back to original env vars
    process.env = { ...originalEnv }
    await tearDownPostgres(setupParams).catch((e) => {
      console.error(e)
    })
  })

  test('basic introspection', async () => {
    ctx.fixture('introspection/postgresql')
    const introspect = new DbPull()
    const result = introspect.parse(['--print'])
    await expect(result).resolves.toMatchInlineSnapshot(``)
    expect(ctx.mocked['console.log'].mock.calls.join('\n')).toMatchSnapshot()
    expect(ctx.mocked['console.info'].mock.calls.join('\n')).toMatchInlineSnapshot(``)
    expect(ctx.mocked['console.error'].mock.calls.join('\n')).toMatchInlineSnapshot(``)
    expect(ctx.mocked['process.stdout.write'].mock.calls.join('\n')).toMatchInlineSnapshot(``)
    expect(ctx.mocked['process.stderr.write'].mock.calls.join('\n')).toMatchInlineSnapshot(``)
  })

  test('basic introspection --url', async () => {
    const introspect = new DbPull()
    const result = introspect.parse(['--print', '--url', setupParams.connectionString])
    await expect(result).resolves.toMatchInlineSnapshot(``)
    expect(ctx.mocked['console.log'].mock.calls.join('\n')).toMatchSnapshot()
    expect(ctx.mocked['console.info'].mock.calls.join('\n')).toMatchInlineSnapshot(``)
    expect(ctx.mocked['console.error'].mock.calls.join('\n')).toMatchInlineSnapshot(``)
    expect(ctx.mocked['process.stdout.write'].mock.calls.join('\n')).toMatchInlineSnapshot(``)
    expect(ctx.mocked['process.stderr.write'].mock.calls.join('\n')).toMatchInlineSnapshot(``)
  })

  test('introspection should load .env file with --print', async () => {
    ctx.fixture('schema-only-postgresql')
    expect.assertions(7)

    try {
      await DbPull.new().parse(['--print', '--schema=./prisma/using-dotenv.prisma'])
    } catch (e) {
      expect(e.code).toEqual('P1001')
      expect(e.message).toContain(`fromdotenvdoesnotexist`)
    }

    expect(ctx.mocked['console.log'].mock.calls.join('\n')).toMatchInlineSnapshot(``)
    expect(ctx.mocked['console.info'].mock.calls.join('\n')).toMatchInlineSnapshot(``)
    expect(ctx.mocked['console.error'].mock.calls.join('\n')).toMatchInlineSnapshot(``)
    expect(ctx.mocked['process.stdout.write'].mock.calls.join('\n')).toMatchInlineSnapshot(``)
    expect(ctx.mocked['process.stderr.write'].mock.calls.join('\n')).toMatchInlineSnapshot(``)
  })

  test('introspection should load .env file without --print', async () => {
    ctx.fixture('schema-only-postgresql')
    expect.assertions(7)

    try {
      await DbPull.new().parse(['--schema=./prisma/using-dotenv.prisma'])
    } catch (e) {
      expect(e.code).toEqual('P1001')
      expect(e.message).toContain(`fromdotenvdoesnotexist`)
    }

    expect(ctx.mocked['console.log'].mock.calls.join('\n')).toMatchInlineSnapshot(``)
    expect(ctx.mocked['console.info'].mock.calls.join('\n')).toMatchInlineSnapshot(`
      Prisma schema loaded from prisma/using-dotenv.prisma
      Environment variables loaded from prisma/.env
      Datasource "my_db": PostgreSQL database "mydb", schema "public" at "fromdotenvdoesnotexist:5432"

    `)
    expect(ctx.mocked['console.error'].mock.calls.join('\n')).toMatchInlineSnapshot(``)
    expect(ctx.mocked['process.stdout.write'].mock.calls.join('\n')).toMatchInlineSnapshot(`


                  - Introspecting based on datasource defined in prisma/using-dotenv.prisma

                  ✖ Introspecting based on datasource defined in prisma/using-dotenv.prisma

              `)
    expect(ctx.mocked['process.stderr.write'].mock.calls.join('\n')).toMatchInlineSnapshot(``)
  })

  test('introspection --url with postgresql provider but schema has a sqlite provider should fail', async () => {
    ctx.fixture('schema-only-sqlite')
    expect.assertions(7)

    try {
      await DbPull.new().parse(['--url', setupParams.connectionString])
    } catch (e) {
      expect(e.code).toEqual(undefined)
      expect(e.message).toMatchInlineSnapshot(
        `The database provider found in --url (postgresql) is different from the provider found in the Prisma schema (sqlite).`,
      )
    }

    expect(ctx.mocked['console.log'].mock.calls.join('\n')).toMatchInlineSnapshot(``)
    expect(ctx.mocked['console.info'].mock.calls.join('\n')).toMatchInlineSnapshot(`
      Prisma schema loaded from prisma/schema.prisma
      Datasource "my_db": SQLite database "dev.db" at "file:dev.db"
    `)
    expect(ctx.mocked['console.error'].mock.calls.join('\n')).toMatchInlineSnapshot(``)
    expect(ctx.mocked['process.stdout.write'].mock.calls.join('\n')).toMatchInlineSnapshot(``)
    expect(ctx.mocked['process.stderr.write'].mock.calls.join('\n')).toMatchInlineSnapshot(``)
  })

  test('introspection works with directUrl from env var', async () => {
    ctx.fixture('schema-only-data-proxy')
    const result = DbPull.new().parse(['--schema', 'with-directUrl-env.prisma'])

    await expect(result).resolves.toMatchInlineSnapshot(``)
    expect(ctx.mocked['console.info'].mock.calls.join('\n')).toMatchInlineSnapshot(`
      Prisma schema loaded from with-directUrl-env.prisma
      Environment variables loaded from .env
      Datasource "db": PostgreSQL database "tests-migrate-db-pull-postgresql", schema "public" at "localhost:5432"
    `)
    expect(ctx.mocked['console.error'].mock.calls.join('\n')).toMatchInlineSnapshot(``)
    expect(ctx.mocked['process.stdout.write'].mock.calls.join('\n')).toMatchInlineSnapshot(`


                  - Introspecting based on datasource defined in with-directUrl-env.prisma

                  ✔ Introspected 2 models and wrote them into with-directUrl-env.prisma in XXXms
                        
                  Run prisma generate to generate Prisma Client.

            `)
    expect(ctx.mocked['process.stderr.write'].mock.calls.join('\n')).toMatchInlineSnapshot(``)
  })
})
