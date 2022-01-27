import path from 'path'
import { DbPull } from '../commands/DbPull'
import { jestConsoleContext, jestContext } from '@prisma/sdk'
import { SetupParams, setupPostgres, tearDownPostgres } from '../utils/setupPostgres'
import { setupMysql, tearDownMysql } from '../utils/setupMysql'
import { setupMSSQL, tearDownMSSQL } from '../utils/setupMSSQL'

const isMacOrWindowsCI = Boolean(process.env.CI) && ['darwin', 'win32'].includes(process.platform)

if (isMacOrWindowsCI) {
  jest.setTimeout(60000)
}

const describeIf = (condition: boolean) => (condition ? describe : describe.skip)
const testIf = (condition: boolean) => (condition ? test : test.skip)

const ctx = jestContext.new().add(jestConsoleContext()).assemble()

describe('common/sqlite', () => {
  test('basic introspection', async () => {
    ctx.fixture('introspection/sqlite')
    const introspect = new DbPull()
    await introspect.parse(['--print'])
    expect(ctx.mocked['console.log'].mock.calls.join('\n')).toMatchSnapshot()
    expect(ctx.mocked['console.info'].mock.calls.join('\n')).toMatchInlineSnapshot(``)
    expect(ctx.mocked['console.error'].mock.calls.join('\n')).toMatchInlineSnapshot(``)
  })

  test('introspection --force', async () => {
    ctx.fixture('introspection/sqlite')
    const introspect = new DbPull()
    await introspect.parse(['--print', '--force'])
    expect(ctx.mocked['console.log'].mock.calls.join('\n')).toMatchSnapshot()
    expect(ctx.mocked['console.info'].mock.calls.join('\n')).toMatchInlineSnapshot(``)
    expect(ctx.mocked['console.error'].mock.calls.join('\n')).toMatchInlineSnapshot(``)
  })

  // TODO: Windows: fails with
  // Error: P1012 Introspection failed as your current Prisma schema file is invalid·
  //     Please fix your current schema manually, use prisma validate to confirm it is valid and then run this command again.
  //     Or run this command with the --force flag to ignore your current schema and overwrite it. All local modifications will be lost.
  testIf(process.platform !== 'win32')('basic introspection with --url', async () => {
    ctx.fixture('introspection/sqlite')
    const introspect = new DbPull()
    const result = introspect.parse(['--print', '--url', 'file:dev.db'])
    await expect(result).resolves.toBe('')
    expect(ctx.mocked['console.log'].mock.calls.join('\n')).toMatchSnapshot()
    expect(ctx.mocked['console.info'].mock.calls.join('\n')).toMatchInlineSnapshot(``)
    expect(ctx.mocked['console.error'].mock.calls.join('\n')).toMatchInlineSnapshot(``)
  })

  test('basic introspection with invalid --url', async () => {
    ctx.fixture('introspection/sqlite')
    const introspect = new DbPull()
    const result = introspect.parse(['--print', '--url', 'invalidstring'])
    await expect(result).rejects.toThrowErrorMatchingInlineSnapshot(`Unknown database type invalidstring:`)
    expect(ctx.mocked['console.log'].mock.calls.join('\n')).toMatchSnapshot()
    expect(ctx.mocked['console.info'].mock.calls.join('\n')).toMatchInlineSnapshot(``)
    expect(ctx.mocked['console.error'].mock.calls.join('\n')).toMatchInlineSnapshot(``)
  })

  it('should succeed when schema and db do match', async () => {
    ctx.fixture('introspect/prisma')
    const result = DbPull.new().parse([])
    await expect(result).resolves.toMatchInlineSnapshot(``)

    expect(ctx.mocked['console.log'].mock.calls.join('\n').replace(/\d{2,3}ms/, 'XXms')).toMatchInlineSnapshot(``)
    expect(ctx.mocked['console.info'].mock.calls.join('\n')).toMatchInlineSnapshot(`
      Prisma schema loaded from schema.prisma
      Datasource "db": SQLite database "dev.db" at "file:dev.db"

      Introspecting based on datasource defined in schema.prisma …

      ✔ Introspected 3 models and wrote them into schema.prisma in XXXms
            
      Run prisma generate to generate Prisma Client.
    `)
    expect(ctx.mocked['console.error'].mock.calls.join('\n')).toMatchInlineSnapshot(``)
  })

  // TODO: Windows: fails with
  // Error: P1012 Introspection failed as your current Prisma schema file is invalid·
  //     Please fix your current schema manually, use prisma validate to confirm it is valid and then run this command again.
  //     Or run this command with the --force flag to ignore your current schema and overwrite it. All local modifications will be lost.
  testIf(process.platform !== 'win32')('should succeed when schema and db do match using --url', async () => {
    ctx.fixture('introspect/prisma')
    const result = DbPull.new().parse(['--url=file:./dev.db'])
    await expect(result).resolves.toMatchInlineSnapshot(``)

    expect(ctx.mocked['console.log'].mock.calls.join('\n').replace(/\d{2,3}ms/, 'XXms')).toMatchInlineSnapshot(``)
    expect(ctx.mocked['console.info'].mock.calls.join('\n')).toMatchInlineSnapshot(`
      Prisma schema loaded from schema.prisma
      Datasource "db": SQLite database "dev.db" at "file:dev.db"

      Introspecting …

      ✔ Introspected 3 models and wrote them into schema.prisma in XXXms
            
      Run prisma generate to generate Prisma Client.
    `)
    expect(ctx.mocked['console.error'].mock.calls.join('\n')).toMatchInlineSnapshot(``)
  })

  test('basic introspection with invalid --url - empty host', async () => {
    const introspect = new DbPull()
    const result = introspect.parse(['--print', '--url', 'postgresql://root:prisma@/prisma'])
    await expect(result).rejects.toThrowErrorMatchingInlineSnapshot(`
                      Error parsing connection string: empty host in database URL

                  `)
    expect(ctx.mocked['console.log'].mock.calls.join('\n')).toMatchSnapshot()
    expect(ctx.mocked['console.info'].mock.calls.join('\n')).toMatchInlineSnapshot(``)
    expect(ctx.mocked['console.error'].mock.calls.join('\n')).toMatchInlineSnapshot(``)
  })

  it('should succeed and keep changes to valid schema and output warnings', async () => {
    ctx.fixture('introspect')
    const result = DbPull.new().parse(['--schema=./prisma/reintrospection.prisma'])
    await expect(result).resolves.toMatchInlineSnapshot(``)

    expect(ctx.mocked['console.log'].mock.calls.join('\n').replace(/\d{2,3}ms/, 'in XXms')).toMatchInlineSnapshot(``)
    expect(ctx.mocked['console.info'].mock.calls.join('\n')).toMatchInlineSnapshot(`
      Prisma schema loaded from prisma/reintrospection.prisma
      Datasource "db": SQLite database "dev.db" at "file:dev.db"

      Introspecting based on datasource defined in prisma/reintrospection.prisma …

      ✔ Introspected 3 models and wrote them into prisma/reintrospection.prisma in XXXms
            
      *** WARNING ***

      These models were enriched with \`@@map\` information taken from the previous Prisma schema.
      - Model "AwesomeNewPost"
      - Model "AwesomeProfile"
      - Model "AwesomeUser"

      Run prisma generate to generate Prisma Client.
    `)
    expect(ctx.mocked['console.error'].mock.calls.join('\n')).toMatchInlineSnapshot(``)

    expect(ctx.fs.read('prisma/reintrospection.prisma')).toMatchInlineSnapshot(`
      generator client {
        provider = "prisma-client-js"
        output   = "../generated/client"
      }

      datasource db {
        provider = "sqlite"
        url      = "file:dev.db"
      }

      model AwesomeUser {
        email    String           @unique(map: "User.email")
        id       Int              @id @default(autoincrement())
        name     String?
        newPosts AwesomeNewPost[]
        profile  AwesomeProfile?

        @@map("User")
      }

      model AwesomeNewPost {
        authorId  Int
        content   String?
        createdAt DateTime    @default(now())
        id        Int         @id @default(autoincrement())
        published Boolean     @default(false)
        title     String
        author    AwesomeUser @relation(fields: [authorId], references: [id], onDelete: Cascade)

        @@map("Post")
      }

      model AwesomeProfile {
        bio    String?
        id     Int         @id @default(autoincrement())
        userId Int         @unique(map: "Profile.userId")
        user   AwesomeUser @relation(fields: [userId], references: [id], onDelete: Cascade)

        @@map("Profile")
      }

    `)
  })

  it('should succeed and keep changes to valid schema and output warnings when using --print', async () => {
    ctx.fixture('introspect')
    const originalSchema = ctx.fs.read('prisma/reintrospection.prisma')
    const result = DbPull.new().parse(['--print', '--schema=./prisma/reintrospection.prisma'])
    await expect(result).resolves.toMatchInlineSnapshot(``)

    expect(ctx.mocked['console.log'].mock.calls.join('\n').replace(/\d{2,3}ms/, 'in XXms')).toMatchSnapshot()
    expect(ctx.mocked['console.info'].mock.calls.join('\n')).toMatchInlineSnapshot(``)
    expect(ctx.mocked['console.error'].mock.calls.join('\n')).toMatchInlineSnapshot(`

                                                                                                                                                                          // *** WARNING ***
                                                                                                                                                                          // 
                                                                                                                                                                          // These models were enriched with \`@@map\` information taken from the previous Prisma schema.
                                                                                                                                                                          // - Model "AwesomeNewPost"
                                                                                                                                                                          // - Model "AwesomeProfile"
                                                                                                                                                                          // - Model "AwesomeUser"
                                                                                                                                                                          // 
                                                                                                                `)

    expect(ctx.fs.read('prisma/reintrospection.prisma')).toStrictEqual(originalSchema)
  })

  it('should succeed when schema and db do not match', async () => {
    ctx.fixture('existing-db-histories-diverge')
    const result = DbPull.new().parse([])
    await expect(result).resolves.toMatchInlineSnapshot(``)

    expect(ctx.mocked['console.log'].mock.calls.join('\n').replace(/\d{2,3}ms/, 'in XXms')).toMatchInlineSnapshot(``)
    expect(ctx.mocked['console.info'].mock.calls.join('\n')).toMatchInlineSnapshot(`
      Prisma schema loaded from prisma/schema.prisma
      Datasource "my_db": SQLite database "dev.db" at "file:dev.db"

      Introspecting based on datasource defined in prisma/schema.prisma …

      ✔ Introspected 3 models and wrote them into prisma/schema.prisma in XXXms
            
      Run prisma generate to generate Prisma Client.
    `)
    expect(ctx.mocked['console.error'].mock.calls.join('\n')).toMatchInlineSnapshot(``)
  })

  it('should fail when db is missing', async () => {
    ctx.fixture('schema-only-sqlite')
    const result = DbPull.new().parse([])
    await expect(result).rejects.toThrowErrorMatchingInlineSnapshot(`

                                                P4001 The introspected database was empty: 

                                                prisma db pull could not create any models in your schema.prisma file and you will not be able to generate Prisma Client with the prisma generate command.

                                                To fix this, you have two options:

                                                - manually create a table in your database.
                                                - make sure the database connection URL inside the datasource block in schema.prisma points to a database that is not empty (it must contain at least one table).

                                                Then you can run prisma db pull again. 

                                        `)

    expect(ctx.mocked['console.log'].mock.calls.join('\n')).toMatchInlineSnapshot(``)
    expect(ctx.mocked['console.info'].mock.calls.join('\n')).toMatchInlineSnapshot(`
      Prisma schema loaded from prisma/schema.prisma
      Datasource "my_db": SQLite database "dev.db" at "file:dev.db"

      Introspecting based on datasource defined in prisma/schema.prisma …
    `)
    expect(ctx.mocked['console.error'].mock.calls.join('\n')).toMatchInlineSnapshot(``)
  })

  it('should fail when db is empty', async () => {
    ctx.fixture('schema-only-sqlite')
    ctx.fs.write('prisma/dev.db', '')
    const result = DbPull.new().parse([])
    await expect(result).rejects.toThrowErrorMatchingInlineSnapshot(`

                                                P4001 The introspected database was empty: 

                                                prisma db pull could not create any models in your schema.prisma file and you will not be able to generate Prisma Client with the prisma generate command.

                                                To fix this, you have two options:

                                                - manually create a table in your database.
                                                - make sure the database connection URL inside the datasource block in schema.prisma points to a database that is not empty (it must contain at least one table).

                                                Then you can run prisma db pull again. 

                                        `)

    expect(ctx.mocked['console.log'].mock.calls.join('\n')).toMatchInlineSnapshot(``)
    expect(ctx.mocked['console.info'].mock.calls.join('\n')).toMatchInlineSnapshot(`
      Prisma schema loaded from prisma/schema.prisma
      Datasource "my_db": SQLite database "dev.db" at "file:dev.db"

      Introspecting based on datasource defined in prisma/schema.prisma …
    `)
    expect(ctx.mocked['console.error'].mock.calls.join('\n')).toMatchInlineSnapshot(``)
  })

  it('should fail when Prisma schema is missing', async () => {
    const result = DbPull.new().parse([])
    await expect(result).rejects.toThrowErrorMatchingInlineSnapshot(`
                      Could not find a schema.prisma file that is required for this command.
                      You can either provide it with --schema, set it as \`prisma.schema\` in your package.json or put it into the default location ./prisma/schema.prisma https://pris.ly/d/prisma-schema-location
                  `)

    expect(ctx.mocked['console.log'].mock.calls.join('\n')).toMatchInlineSnapshot(``)
    expect(ctx.mocked['console.info'].mock.calls.join('\n')).toMatchInlineSnapshot(``)
    expect(ctx.mocked['console.error'].mock.calls.join('\n')).toMatchInlineSnapshot(``)
  })

  it('should fail when schema is invalid', async () => {
    ctx.fixture('introspect')
    const result = DbPull.new().parse(['--schema=./prisma/invalid.prisma'])
    await expect(result).rejects.toThrowErrorMatchingInlineSnapshot(`
            P1012 Introspection failed as your current Prisma schema file is invalid

            Please fix your current schema manually, use prisma validate to confirm it is valid and then run this command again.
            Or run this command with the --force flag to ignore your current schema and overwrite it. All local modifications will be lost.

          `)

    expect(ctx.mocked['console.log'].mock.calls.join('\n')).toMatchInlineSnapshot(``)
    expect(ctx.mocked['console.info'].mock.calls.join('\n')).toMatchInlineSnapshot(`
      Prisma schema loaded from prisma/invalid.prisma
      Datasource "db": SQLite database "dev.db" at "file:dev.db"

      Introspecting based on datasource defined in prisma/invalid.prisma …

    `)
    expect(ctx.mocked['console.error'].mock.calls.join('\n')).toMatchInlineSnapshot(``)
  })

  it('should succeed when schema is invalid and using --force', async () => {
    ctx.fixture('introspect')

    const result = DbPull.new().parse(['--schema=./prisma/invalid.prisma', '--force'])
    await expect(result).resolves.toMatchInlineSnapshot(``)

    expect(ctx.mocked['console.log'].mock.calls.join('\n').replace(/\d{2,3}ms/, 'in XXms')).toMatchInlineSnapshot(``)
    expect(ctx.mocked['console.info'].mock.calls.join('\n')).toMatchInlineSnapshot(`
      Prisma schema loaded from prisma/invalid.prisma
      Datasource "db": SQLite database "dev.db" at "file:dev.db"

      Introspecting based on datasource defined in prisma/invalid.prisma …

      ✔ Introspected 3 models and wrote them into prisma/invalid.prisma in XXXms
            
      Run prisma generate to generate Prisma Client.
    `)
    expect(ctx.mocked['console.error'].mock.calls.join('\n')).toMatchInlineSnapshot(``)

    expect(ctx.fs.read('prisma/invalid.prisma')).toMatchSnapshot()
  })
})

describe('postgresql', () => {
  const setupParams: SetupParams = {
    connectionString: process.env.TEST_POSTGRES_URI_MIGRATE || 'postgres://prisma:prisma@localhost:5432/tests-migrate',
    dirname: path.join(__dirname, '..', '__tests__', 'fixtures', 'introspection', 'postgresql'),
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
  })

  afterEach(async () => {
    await tearDownPostgres(setupParams).catch((e) => {
      console.error(e)
    })
  })

  test('basic introspection', async () => {
    ctx.fixture('introspection/postgresql')
    const introspect = new DbPull()
    await introspect.parse(['--print'])
    expect(ctx.mocked['console.log'].mock.calls.join('\n')).toMatchSnapshot()
    expect(ctx.mocked['console.info'].mock.calls.join('\n')).toMatchInlineSnapshot(``)
    expect(ctx.mocked['console.error'].mock.calls.join('\n')).toMatchInlineSnapshot(``)
  })

  test('basic introspection --url', async () => {
    const introspect = new DbPull()
    const result = introspect.parse(['--print', '--url', setupParams.connectionString])
    await expect(result).resolves.toMatchInlineSnapshot(``)
    expect(ctx.mocked['console.log'].mock.calls.join('\n')).toMatchSnapshot()
    expect(ctx.mocked['console.info'].mock.calls.join('\n')).toMatchInlineSnapshot(``)
    expect(ctx.mocked['console.error'].mock.calls.join('\n')).toMatchInlineSnapshot(``)
  })
})

describe('mysql', () => {
  const setupParams: SetupParams = {
    connectionString: process.env.TEST_MYSQL_URI || 'mysql://root:root@localhost:3306/tests',
    dirname: path.join(__dirname, '..', '__tests__', 'fixtures', 'introspection', 'mysql'),
  }

  beforeAll(async () => {
    await tearDownMysql(setupParams).catch((e) => {
      console.error(e)
    })
  })

  beforeEach(async () => {
    await setupMysql(setupParams).catch((e) => {
      console.error(e)
    })
  })

  afterEach(async () => {
    await tearDownMysql(setupParams).catch((e) => {
      console.error(e)
    })
  })

  test('basic introspection', async () => {
    ctx.fixture('introspection/mysql')
    const introspect = new DbPull()
    await introspect.parse(['--print'])
    expect(ctx.mocked['console.log'].mock.calls.join('\n')).toMatchSnapshot()
    expect(ctx.mocked['console.info'].mock.calls.join('\n')).toMatchInlineSnapshot(``)
    expect(ctx.mocked['console.error'].mock.calls.join('\n')).toMatchInlineSnapshot(``)
  })

  // TODO: snapshot fails on CI for macOS and Windows because the connection
  // string is different, either add steps to the database setup to create the
  // user and set password for MySQL, or sanitize the snapshot.
  testIf(!isMacOrWindowsCI)('basic introspection --url', async () => {
    const introspect = new DbPull()
    const result = introspect.parse(['--print', '--url', setupParams.connectionString])
    await expect(result).resolves.toMatchInlineSnapshot(``)
    expect(ctx.mocked['console.log'].mock.calls.join('\n')).toMatchSnapshot()
    expect(ctx.mocked['console.info'].mock.calls.join('\n')).toMatchInlineSnapshot(``)
    expect(ctx.mocked['console.error'].mock.calls.join('\n')).toMatchInlineSnapshot(``)
  })
})

describeIf(!process.env.TEST_SKIP_MSSQL)('SQL Server', () => {
  jest.setTimeout(20000)

  const connectionString = process.env.TEST_MSSQL_URI || 'mssql://SA:Pr1sm4_Pr1sm4@localhost:1433/master'
  const setupParams: SetupParams = {
    connectionString,
    dirname: path.join(__dirname, '..', '__tests__', 'fixtures', 'introspection', 'sqlserver'),
  }
  const JDBC_URI =
    process.env.TEST_MSSQL_JDBC_URI_MIGRATE ||
    'sqlserver://localhost:1433;database=tests-migrate;user=SA;password=Pr1sm4_Pr1sm4;trustServerCertificate=true;'

  beforeAll(async () => {
    await tearDownMSSQL(setupParams, 'tests-migrate').catch((e) => {
      console.error(e)
    })
  })

  beforeEach(async () => {
    await setupMSSQL(setupParams, 'tests-migrate').catch((e) => {
      console.error(e)
    })
  })

  afterEach(async () => {
    await tearDownMSSQL(setupParams, 'tests-migrate').catch((e) => {
      console.error(e)
    })
  })

  test('basic introspection', async () => {
    ctx.fixture('introspection/sqlserver')
    const introspect = new DbPull()
    await introspect.parse(['--print'])
    expect(ctx.mocked['console.log'].mock.calls.join('\n')).toMatchSnapshot()
    expect(ctx.mocked['console.info'].mock.calls.join('\n')).toMatchInlineSnapshot(``)
    expect(ctx.mocked['console.error'].mock.calls.join('\n')).toMatchInlineSnapshot(``)
  })

  test('basic introspection --url', async () => {
    const introspect = new DbPull()
    const result = introspect.parse(['--print', '--url', JDBC_URI])
    await expect(result).resolves.toMatchInlineSnapshot(``)
    expect(ctx.mocked['console.log'].mock.calls.join('\n')).toMatchSnapshot()
    expect(ctx.mocked['console.info'].mock.calls.join('\n')).toMatchInlineSnapshot(``)
    expect(ctx.mocked['console.error'].mock.calls.join('\n')).toMatchInlineSnapshot(``)
  })
})

// TODO: Windows: tests fail on Windows, introspected schema differs from snapshots.
// TODO: macOS: disabled on CI because it fails with timeout. Somehow jest.setTimeout
// doesn't seem to work in this test case particularly.
describeIf(process.platform !== 'win32' && !isMacOrWindowsCI)('MongoDB', () => {
  const MONGO_URI =
    process.env.TEST_MONGO_URI_MIGRATE || 'mongodb://root:prisma@localhost:27017/tests-migrate?authSource=admin'

  test('basic introspection', async () => {
    ctx.fixture('schema-only-mongodb')
    const introspect = new DbPull()
    await introspect.parse(['--schema=./prisma/no-model.prisma'])
    expect(ctx.mocked['console.log'].mock.calls.join('\n')).toMatchSnapshot()
    expect(ctx.mocked['console.info'].mock.calls.join('\n')).toMatchInlineSnapshot(`
      Prisma schema loaded from prisma/no-model.prisma
      Datasource "my_db"

      Introspecting based on datasource defined in prisma/no-model.prisma …

      ✔ Introspected 1 model and wrote it into prisma/no-model.prisma in XXXms
            
      Run prisma generate to generate Prisma Client.
    `)
    expect(ctx.mocked['console.error'].mock.calls.join('\n')).toMatchInlineSnapshot(``)
  })

  test('introspection --print', async () => {
    ctx.fixture('schema-only-mongodb')
    const introspect = new DbPull()
    await introspect.parse(['--print'])
    expect(ctx.mocked['console.log'].mock.calls.join('\n')).toMatchSnapshot()
    expect(ctx.mocked['console.info'].mock.calls.join('\n')).toMatchInlineSnapshot(``)
    expect(ctx.mocked['console.error'].mock.calls.join('\n')).toMatchInlineSnapshot(``)
  })

  test('introspection --print --composite-type-depth=0', async () => {
    ctx.fixture('schema-only-mongodb')
    const introspect = new DbPull()
    await introspect.parse(['--print', '--composite-type-depth=0'])
    expect(ctx.mocked['console.log'].mock.calls.join('\n')).toMatchSnapshot()
    expect(ctx.mocked['console.info'].mock.calls.join('\n')).toMatchInlineSnapshot(``)
    expect(ctx.mocked['console.error'].mock.calls.join('\n')).toMatchInlineSnapshot(``)
  })

  test('introspection --print --composite-type-depth=1', async () => {
    ctx.fixture('schema-only-mongodb')
    const introspect = new DbPull()
    await introspect.parse(['--print', '--composite-type-depth=1'])
    expect(ctx.mocked['console.log'].mock.calls.join('\n')).toMatchSnapshot()
    expect(ctx.mocked['console.info'].mock.calls.join('\n')).toMatchInlineSnapshot(``)
    expect(ctx.mocked['console.error'].mock.calls.join('\n')).toMatchInlineSnapshot(``)
  })

  test('introspection --print --composite-type-depth=-1', async () => {
    ctx.fixture('schema-only-mongodb')
    const introspect = new DbPull()
    await introspect.parse(['--print', '--composite-type-depth=-1'])
    expect(ctx.mocked['console.log'].mock.calls.join('\n')).toMatchSnapshot()
    expect(ctx.mocked['console.info'].mock.calls.join('\n')).toMatchInlineSnapshot(``)
    expect(ctx.mocked['console.error'].mock.calls.join('\n')).toMatchInlineSnapshot(``)
  })

  test('basic introspection --url', async () => {
    const introspect = new DbPull()
    const result = introspect.parse(['--print', '--url', MONGO_URI])
    await expect(result).rejects.toThrowErrorMatchingInlineSnapshot(`
            Preview feature not enabled: MongoDB introspection connector (experimental feature, needs to be enabled)

          `)
    expect(ctx.mocked['console.log'].mock.calls.join('\n')).toMatchSnapshot()
    expect(ctx.mocked['console.info'].mock.calls.join('\n')).toMatchInlineSnapshot(``)
    expect(ctx.mocked['console.error'].mock.calls.join('\n')).toMatchInlineSnapshot(``)
  })

  test('introspection with --force', async () => {
    ctx.fixture('schema-only-mongodb')
    const introspect = new DbPull()
    const result = introspect.parse(['--force'])
    await expect(result).resolves.toMatchInlineSnapshot(``)
    expect(ctx.mocked['console.log'].mock.calls.join('\n')).toMatchSnapshot()
    expect(ctx.mocked['console.info'].mock.calls.join('\n')).toMatchInlineSnapshot(`
      Prisma schema loaded from prisma/schema.prisma
      Datasource "my_db"

      Introspecting based on datasource defined in prisma/schema.prisma …

      ✔ Introspected 1 model and wrote it into prisma/schema.prisma in XXXms
            
      Run prisma generate to generate Prisma Client.
    `)
    expect(ctx.mocked['console.error'].mock.calls.join('\n')).toMatchInlineSnapshot(``)
  })

  test('re-introspection should error (not supported)', async () => {
    ctx.fixture('schema-only-mongodb')
    const introspect = new DbPull()
    await introspect.parse(['--schema=./prisma/no-model.prisma'])
    // now re-introspection
    const result = introspect.parse(['--schema=./prisma/no-model.prisma'])
    await expect(result).rejects.toThrowErrorMatchingInlineSnapshot(`
            Iterating on one schema using re-introspection with db pull is currently not supported with MongoDB provider (Preview).
            You can explicitely ignore and override your current local schema file with prisma db pull --force
            Some information will be lost (relations, comments, mapped fields, @ignore...), follow https://github.com/prisma/prisma/issues/9585 for more info.
          `)
    expect(ctx.mocked['console.log'].mock.calls.join('\n')).toMatchSnapshot()
    expect(ctx.mocked['console.info'].mock.calls.join('\n')).toMatchInlineSnapshot(`
      Prisma schema loaded from prisma/no-model.prisma
      Datasource "my_db"

      Introspecting based on datasource defined in prisma/no-model.prisma …

      ✔ Introspected 1 model and wrote it into prisma/no-model.prisma in XXXms
            
      Run prisma generate to generate Prisma Client.
      Prisma schema loaded from prisma/no-model.prisma
      Datasource "my_db"

      Introspecting based on datasource defined in prisma/no-model.prisma …
    `)
    expect(ctx.mocked['console.error'].mock.calls.join('\n')).toMatchInlineSnapshot(``)
  })
})
