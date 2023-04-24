// describeIf is making eslint unhappy about the test names
/* eslint-disable jest/no-identical-title */

import { jestConsoleContext, jestContext, jestProcessContext } from '@prisma/get-platform'
import { getSchema } from '@prisma/internals'
import path from 'path'

import { DbPull } from '../commands/DbPull'
import { MigrateEngine } from '../MigrateEngine'
import { setupCockroach, tearDownCockroach } from '../utils/setupCockroach'
import { setupMSSQL, tearDownMSSQL } from '../utils/setupMSSQL'
import { setupMysql, tearDownMysql } from '../utils/setupMysql'
import type { SetupParams } from '../utils/setupPostgres'
import { setupPostgres, tearDownPostgres } from '../utils/setupPostgres'

const isMacOrWindowsCI = Boolean(process.env.CI) && ['darwin', 'win32'].includes(process.platform)
if (isMacOrWindowsCI) {
  jest.setTimeout(60_000)
}

const describeIf = (condition: boolean) => (condition ? describe : describe.skip)
const testIf = (condition: boolean) => (condition ? test : test.skip)

const ctx = jestContext.new().add(jestConsoleContext()).add(jestProcessContext()).assemble()

// To avoid the loading spinner locally
process.env.CI = 'true'

const originalEnv = { ...process.env }

// We want to remove unique IDs to have stable snapshots
// Example:
// `PK__User__3213E83E450CDF1F` will be changed to `PK__User__RANDOM_ID_SANITIZED`
function sanitizeSQLServerIdName(schema: string) {
  const schemaRows = schema.split('\n')
  const regexp = new RegExp(/map: "PK__(.*)__(.*)"/)
  const schemaRowsSanitized = schemaRows.map((row) => {
    const match = regexp.exec(row)
    if (match) {
      row = row.replace(match[2], 'RANDOM_ID_SANITIZED')
    }
    return row
  })
  return schemaRowsSanitized.join('\n')
}

describe('common/sqlite', () => {
  test('basic introspection', async () => {
    ctx.fixture('introspection/sqlite')
    const introspect = new DbPull()
    const result = introspect.parse(['--print'])
    await expect(result).resolves.toMatchInlineSnapshot(``)
    expect(ctx.mocked['console.log'].mock.calls.join('\n')).toMatchSnapshot()
    expect(ctx.mocked['console.info'].mock.calls.join('\n')).toMatchInlineSnapshot(``)
    expect(ctx.mocked['console.error'].mock.calls.join('\n')).toMatchInlineSnapshot(``)
    expect(ctx.mocked['process.stdout.write'].mock.calls.join('\n')).toMatchInlineSnapshot(``)
    expect(ctx.mocked['process.stderr.write'].mock.calls.join('\n')).toMatchInlineSnapshot(``)
  })

  test('introspection --force', async () => {
    ctx.fixture('introspection/sqlite')
    const introspect = new DbPull()
    const result = introspect.parse(['--print', '--force'])
    await expect(result).resolves.toMatchInlineSnapshot(``)
    expect(ctx.mocked['console.log'].mock.calls.join('\n')).toMatchSnapshot()
    expect(ctx.mocked['console.info'].mock.calls.join('\n')).toMatchInlineSnapshot(``)
    expect(ctx.mocked['console.error'].mock.calls.join('\n')).toMatchInlineSnapshot(``)
    expect(ctx.mocked['process.stdout.write'].mock.calls.join('\n')).toMatchInlineSnapshot(``)
    expect(ctx.mocked['process.stderr.write'].mock.calls.join('\n')).toMatchInlineSnapshot(``)
  })

  test('basic introspection with --url', async () => {
    ctx.fixture('introspection/sqlite')
    const introspect = new DbPull()
    const result = introspect.parse(['--print', '--url', 'file:dev.db'])
    await expect(result).resolves.toBe('')
    expect(ctx.mocked['console.log'].mock.calls.join('\n')).toMatchSnapshot()
    expect(ctx.mocked['console.info'].mock.calls.join('\n')).toMatchInlineSnapshot(``)
    expect(ctx.mocked['console.error'].mock.calls.join('\n')).toMatchInlineSnapshot(``)
    expect(ctx.mocked['process.stdout.write'].mock.calls.join('\n')).toMatchInlineSnapshot(``)
    expect(ctx.mocked['process.stderr.write'].mock.calls.join('\n')).toMatchInlineSnapshot(``)
  })

  test('basic introspection with schema and --url missing file: prefix should fail', async () => {
    ctx.fixture('introspection/sqlite')
    const introspect = new DbPull()
    const result = introspect.parse(['--print', '--url', 'withoutfileprefix.db'])
    await expect(result).rejects.toThrowErrorMatchingInlineSnapshot(`Unknown protocol withoutfileprefix.db:`)
    expect(ctx.mocked['console.log'].mock.calls.join('\n')).toMatchSnapshot()
    expect(ctx.mocked['console.info'].mock.calls.join('\n')).toMatchInlineSnapshot(``)
    expect(ctx.mocked['console.error'].mock.calls.join('\n')).toMatchInlineSnapshot(``)
    expect(ctx.mocked['process.stdout.write'].mock.calls.join('\n')).toMatchInlineSnapshot(``)
    expect(ctx.mocked['process.stderr.write'].mock.calls.join('\n')).toMatchInlineSnapshot(``)
  })

  test('basic introspection without schema and with --url missing "file:" prefix should fail', async () => {
    const introspect = new DbPull()
    const result = introspect.parse(['--print', '--url', 'withoutfileprefix.db'])
    await expect(result).rejects.toThrowErrorMatchingInlineSnapshot(`Unknown protocol withoutfileprefix.db:`)
    expect(ctx.mocked['console.log'].mock.calls.join('\n')).toMatchSnapshot()
    expect(ctx.mocked['console.info'].mock.calls.join('\n')).toMatchInlineSnapshot(``)
    expect(ctx.mocked['console.error'].mock.calls.join('\n')).toMatchInlineSnapshot(``)
    expect(ctx.mocked['process.stdout.write'].mock.calls.join('\n')).toMatchInlineSnapshot(``)
    expect(ctx.mocked['process.stderr.write'].mock.calls.join('\n')).toMatchInlineSnapshot(``)
  })

  test('basic introspection with invalid --url if schema is unspecified', async () => {
    const introspect = new DbPull()
    const result = introspect.parse(['--print', '--url', 'invalidstring'])
    await expect(result).rejects.toThrowErrorMatchingInlineSnapshot(`Unknown protocol invalidstring:`)
    expect(ctx.mocked['console.log'].mock.calls.join('\n')).toMatchSnapshot()
    expect(ctx.mocked['console.info'].mock.calls.join('\n')).toMatchInlineSnapshot(``)
    expect(ctx.mocked['console.error'].mock.calls.join('\n')).toMatchInlineSnapshot(``)
    expect(ctx.mocked['process.stdout.write'].mock.calls.join('\n')).toMatchInlineSnapshot(``)
    expect(ctx.mocked['process.stderr.write'].mock.calls.join('\n')).toMatchInlineSnapshot(``)
  })

  it('should succeed when schema and db do match', async () => {
    ctx.fixture('introspect/prisma')
    const result = DbPull.new().parse([])
    await expect(result).resolves.toMatchInlineSnapshot(``)
    expect(ctx.mocked['console.log'].mock.calls.join('\n').replace(/\d{2,3}ms/, 'XXms')).toMatchInlineSnapshot(``)
    expect(ctx.mocked['console.info'].mock.calls.join('\n')).toMatchInlineSnapshot(`
      Prisma schema loaded from schema.prisma
      Datasource "db": SQLite database "dev.db" at "file:dev.db"
    `)
    expect(ctx.mocked['console.error'].mock.calls.join('\n')).toMatchInlineSnapshot(``)
    expect(ctx.mocked['process.stdout.write'].mock.calls.join('\n')).toMatchInlineSnapshot(`
      
      
      - Introspecting based on datasource defined in schema.prisma
      
      ✔ Introspected 3 models and wrote them into schema.prisma in XXXms
            
      Run prisma generate to generate Prisma Client.
      
    `)
    expect(ctx.mocked['process.stderr.write'].mock.calls.join('\n')).toMatchInlineSnapshot(``)
  })

  test('should succeed when schema and db do match using --url', async () => {
    ctx.fixture('introspect/prisma')
    const result = DbPull.new().parse(['--url=file:./dev.db'])
    await expect(result).resolves.toMatchInlineSnapshot(``)
    expect(ctx.mocked['console.log'].mock.calls.join('\n').replace(/\d{2,3}ms/, 'XXms')).toMatchInlineSnapshot(``)
    expect(ctx.mocked['console.info'].mock.calls.join('\n')).toMatchInlineSnapshot(`
      Prisma schema loaded from schema.prisma
      Datasource "db": SQLite database "dev.db" at "file:dev.db"
    `)
    expect(ctx.mocked['console.error'].mock.calls.join('\n')).toMatchInlineSnapshot(``)
    expect(ctx.mocked['process.stdout.write'].mock.calls.join('\n')).toMatchInlineSnapshot(`
      
      
      - Introspecting
      
      ✔ Introspected 3 models and wrote them into schema.prisma in XXXms
            
      Run prisma generate to generate Prisma Client.
      
    `)
    expect(ctx.mocked['process.stderr.write'].mock.calls.join('\n')).toMatchInlineSnapshot(``)
  })

  test('basic introspection with invalid --url - empty host', async () => {
    const introspect = new DbPull()
    const result = introspect.parse(['--print', '--url', 'postgresql://root:prisma@/prisma'])
    await expect(result).rejects.toThrowErrorMatchingInlineSnapshot(`
      P1013

      The provided database string is invalid. empty host in database URL. Please refer to the documentation in https://www.prisma.io/docs/reference/database-reference/connection-urls for constructing a correct connection string. In some cases, certain characters must be escaped. Please check the string for any illegal characters.

    `)
    expect(ctx.mocked['console.log'].mock.calls.join('\n')).toMatchSnapshot()
    expect(ctx.mocked['console.info'].mock.calls.join('\n')).toMatchInlineSnapshot(``)
    expect(ctx.mocked['console.error'].mock.calls.join('\n')).toMatchInlineSnapshot(``)
    expect(ctx.mocked['process.stdout.write'].mock.calls.join('\n')).toMatchInlineSnapshot(``)
    expect(ctx.mocked['process.stderr.write'].mock.calls.join('\n')).toMatchInlineSnapshot(``)
  })

  it('should succeed and keep changes to valid schema and output warnings', async () => {
    ctx.fixture('introspect')
    const result = DbPull.new().parse(['--schema=./prisma/reintrospection.prisma'])
    await expect(result).resolves.toMatchInlineSnapshot(``)

    expect(ctx.mocked['console.log'].mock.calls.join('\n').replace(/\d{2,3}ms/, 'in XXms')).toMatchInlineSnapshot(``)
    expect(ctx.mocked['console.info'].mock.calls.join('\n')).toMatchInlineSnapshot(`
      Prisma schema loaded from prisma/reintrospection.prisma
      Datasource "db": SQLite database "dev.db" at "file:dev.db"
    `)
    expect(ctx.mocked['console.error'].mock.calls.join('\n')).toMatchInlineSnapshot(``)
    expect(ctx.mocked['process.stdout.write'].mock.calls.join('\n')).toMatchInlineSnapshot(`


                                                - Introspecting based on datasource defined in prisma/reintrospection.prisma

                                                ✔ Introspected 3 models and wrote them into prisma/reintrospection.prisma in XXXms
                                                      
                                                *** WARNING ***

                                                These models were enriched with \`@@map\` information taken from the previous Prisma schema:
                                                  - AwesomeNewPost
                                                  - AwesomeProfile
                                                  - AwesomeUser

                                                Run prisma generate to generate Prisma Client.

                                `)
    expect(ctx.mocked['process.stderr.write'].mock.calls.join('\n')).toMatchInlineSnapshot(``)

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
      // These models were enriched with \`@@map\` information taken from the previous Prisma schema:
      //   - AwesomeNewPost
      //   - AwesomeProfile
      //   - AwesomeUser
      // 
    `)
    expect(ctx.mocked['process.stdout.write'].mock.calls.join('\n')).toMatchInlineSnapshot(``)
    expect(ctx.mocked['process.stderr.write'].mock.calls.join('\n')).toMatchInlineSnapshot(``)

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
    `)
    expect(ctx.mocked['console.error'].mock.calls.join('\n')).toMatchInlineSnapshot(``)
    expect(ctx.mocked['process.stdout.write'].mock.calls.join('\n')).toMatchInlineSnapshot(`
      
      
      - Introspecting based on datasource defined in prisma/schema.prisma
      
      ✔ Introspected 3 models and wrote them into prisma/schema.prisma in XXXms
            
      Run prisma generate to generate Prisma Client.
      
    `)
    expect(ctx.mocked['process.stderr.write'].mock.calls.join('\n')).toMatchInlineSnapshot(``)
  })

  it('should fail when db is missing', async () => {
    ctx.fixture('schema-only-sqlite')
    const result = DbPull.new().parse([])
    await expect(result).rejects.toThrowErrorMatchingInlineSnapshot(`

        P1003 The introspected database does not exist: 

        prisma db pull could not create any models in your schema.prisma file and you will not be able to generate Prisma Client with the prisma generate command.

        To fix this, you have two options:

        - manually create a database.
        - make sure the database connection URL inside the datasource block in schema.prisma points to an existing database.

        Then you can run prisma db pull again. 

    `)
    expect(ctx.mocked['console.log'].mock.calls.join('\n')).toMatchInlineSnapshot(``)
    expect(ctx.mocked['console.info'].mock.calls.join('\n')).toMatchInlineSnapshot(`
      Prisma schema loaded from prisma/schema.prisma
      Datasource "my_db": SQLite database "dev.db" at "file:dev.db"
    `)
    expect(ctx.mocked['console.error'].mock.calls.join('\n')).toMatchInlineSnapshot(``)
    expect(ctx.mocked['process.stdout.write'].mock.calls.join('\n')).toMatchInlineSnapshot(`
      
      
      - Introspecting based on datasource defined in prisma/schema.prisma

      ✖ Introspecting based on datasource defined in prisma/schema.prisma
      
    `)
    expect(ctx.mocked['process.stderr.write'].mock.calls.join('\n')).toMatchInlineSnapshot(``)
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
    `)
    expect(ctx.mocked['console.error'].mock.calls.join('\n')).toMatchInlineSnapshot(``)
    expect(ctx.mocked['process.stdout.write'].mock.calls.join('\n')).toMatchInlineSnapshot(`
      
      
      - Introspecting based on datasource defined in prisma/schema.prisma

      ✖ Introspecting based on datasource defined in prisma/schema.prisma
      
    `)
    expect(ctx.mocked['process.stderr.write'].mock.calls.join('\n')).toMatchInlineSnapshot(``)
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
    expect(ctx.mocked['process.stdout.write'].mock.calls.join('\n')).toMatchInlineSnapshot(``)
    expect(ctx.mocked['process.stderr.write'].mock.calls.join('\n')).toMatchInlineSnapshot(``)
  })

  it('should fail when schema is invalid', async () => {
    ctx.fixture('introspect')
    const result = DbPull.new().parse(['--schema=./prisma/invalid.prisma'])
    await expect(result).rejects.toThrowErrorMatchingInlineSnapshot(`
      P1012

      error: Error validating model "something": Each model must have at least one unique criteria that has only required fields. Either mark a single field with \`@id\`, \`@unique\` or add a multi field criterion with \`@@id([])\` or \`@@unique([])\` to the model.
        -->  schema.prisma:11
         | 
      10 | 
      11 | model something {
      12 |   id Int
      13 | }
         | 


      Introspection failed as your current Prisma schema file is invalid

      Please fix your current schema manually (using either prisma validate or the Prisma VS Code extension to understand what's broken and confirm you fixed it), and then run this command again.
      Or run this command with the --force flag to ignore your current schema and overwrite it. All local modifications will be lost.

    `)

    expect(ctx.mocked['console.log'].mock.calls.join('\n')).toMatchInlineSnapshot(``)
    expect(ctx.mocked['console.info'].mock.calls.join('\n')).toMatchInlineSnapshot(`
      Prisma schema loaded from prisma/invalid.prisma
      Datasource "db": SQLite database "dev.db" at "file:dev.db"

    `)
    expect(ctx.mocked['console.error'].mock.calls.join('\n')).toMatchInlineSnapshot(``)
    expect(ctx.mocked['process.stdout.write'].mock.calls.join('\n')).toMatchInlineSnapshot(`


      - Introspecting based on datasource defined in prisma/invalid.prisma

      ✖ Introspecting based on datasource defined in prisma/invalid.prisma

      `)
    expect(ctx.mocked['process.stderr.write'].mock.calls.join('\n')).toMatchInlineSnapshot(``)
  })

  it('should succeed when schema is invalid and using --force', async () => {
    ctx.fixture('introspect')

    const result = DbPull.new().parse(['--schema=./prisma/invalid.prisma', '--force'])
    await expect(result).resolves.toMatchInlineSnapshot(``)

    expect(ctx.mocked['console.log'].mock.calls.join('\n').replace(/\d{2,3}ms/, 'in XXms')).toMatchInlineSnapshot(``)
    expect(ctx.mocked['console.info'].mock.calls.join('\n')).toMatchInlineSnapshot(`
      Prisma schema loaded from prisma/invalid.prisma
      Datasource "db": SQLite database "dev.db" at "file:dev.db"
    `)
    expect(ctx.mocked['console.error'].mock.calls.join('\n')).toMatchInlineSnapshot(``)
    expect(ctx.mocked['process.stdout.write'].mock.calls.join('\n')).toMatchInlineSnapshot(`


      - Introspecting based on datasource defined in prisma/invalid.prisma

      ✔ Introspected 3 models and wrote them into prisma/invalid.prisma in XXXms
            
      Run prisma generate to generate Prisma Client.

    `)
    expect(ctx.mocked['process.stderr.write'].mock.calls.join('\n')).toMatchInlineSnapshot(``)

    expect(ctx.fs.read('prisma/invalid.prisma')).toMatchSnapshot()
  })
})

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

describeIf(process.platform != 'win32')('postgresql views fs I/O', () => {
  const connectionString = process.env.TEST_POSTGRES_URI_MIGRATE!.replace('tests-migrate', 'tests-migrate-db-pull')

  type ViewVariant =
    | 'no-views' // No views in the database
    | 'no-preview' // No "view" in `previewFeatures`

  const variantToPath = (variant?: ViewVariant) => {
    const basePath = 'views-fs' as const
    return variant === undefined ? basePath : (`${basePath}-${variant}` as const)
  }

  const computeSetupParams = (variant?: ViewVariant) => {
    const fixturePath = path.join('introspection', 'postgresql', variantToPath(variant))

    const setupParams: SetupParams = {
      connectionString,
      // Note: dirname points to a location with a setup.sql file
      // which will be executed to prepare the database with the correct tables, views etc.
      dirname: path.join(__dirname, '..', '__tests__', 'fixtures', fixturePath),
    }

    return { setupParams, fixturePath }
  }

  const setupPostgresForViewsIO = (variant?: ViewVariant) => {
    const { setupParams, fixturePath } = computeSetupParams(variant)

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

    return fixturePath
  }

  describe('engine output', () => {
    describe('no preview feature', () => {
      const fixturePath = setupPostgresForViewsIO('no-preview')

      it('`views` is null', async () => {
        ctx.fixture(path.join(fixturePath))

        const engine = new MigrateEngine({
          projectDir: process.cwd(),
          schemaPath: undefined,
        })

        const schema = await getSchema()

        const introspectionResult = await engine.introspect({
          schema,
          force: false,
        })

        expect(introspectionResult.views).toEqual(null)
        engine.stop()
      })
    })

    describe('with preview feature and no views defined', () => {
      const fixturePath = setupPostgresForViewsIO('no-views')

      it('`views` is []', async () => {
        ctx.fixture(path.join(fixturePath))

        const engine = new MigrateEngine({
          projectDir: process.cwd(),
          schemaPath: undefined,
        })

        const schema = await getSchema()

        const introspectionResult = await engine.introspect({
          schema,
          force: false,
        })

        expect(introspectionResult.views).toEqual([])
        engine.stop()
      })
    })
  })

  describe('with preview feature and views defined', () => {
    const fixturePath = setupPostgresForViewsIO()

    test('basic introspection', async () => {
      ctx.fixture(fixturePath)

      const introspect = new DbPull()
      const result = introspect.parse([])
      await expect(result).resolves.toMatchInlineSnapshot(``)

      const list = await ctx.fs.listAsync('views')
      expect(list).toMatchInlineSnapshot(`
        [
          public,
          work,
        ]
      `)

      const tree = await ctx.fs.findAsync({ directories: false, files: true, recursive: true, matching: 'views/**/*' })
      expect(tree).toMatchInlineSnapshot(`
        [
          views/public/simpleuser.sql,
          views/work/workers.sql,
        ]
      `)

      expect(ctx.mocked['console.log'].mock.calls.join('\n')).toMatchInlineSnapshot(``)
      expect(ctx.mocked['console.info'].mock.calls.join('\n')).toMatchInlineSnapshot(`
        Prisma schema loaded from schema.prisma
        Datasource "db": PostgreSQL database "tests-migrate-db-pull", schemas "public, work" at "localhost:5432"
      `)
      expect(ctx.mocked['console.error'].mock.calls.join('\n')).toMatchInlineSnapshot(``)
      expect(ctx.mocked['process.stdout.write'].mock.calls.join('\n')).toMatchInlineSnapshot(`


        - Introspecting based on datasource defined in schema.prisma

        ✔ Introspected 2 models and wrote them into schema.prisma in XXXms
              
        *** WARNING ***

        The following views were ignored as they do not have a valid unique identifier or id. This is currently not supported by the Prisma Client. Please refer to the documentation on defining unique identifiers in views: https://pris.ly/d/view-identifiers
          - simpleuser
          - workers

        Run prisma generate to generate Prisma Client.

      `)
      expect(ctx.mocked['process.stderr.write'].mock.calls.join('\n')).toMatchInlineSnapshot(``)
    })

    const schemaPaths = [
      {
        schemaDir: 'prisma',
        schemaFilename: 'schema.prisma',
        needsMove: true,
        needsPathsArg: false,
      },
      {
        schemaDir: 'custom/schema/dir',
        schemaFilename: 'schema.prisma',
        needsMove: true,
        needsPathsArg: true,
      },
      {
        schemaDir: '',
        schemaFilename: 'non-standard-schema.prisma',
        needsMove: true,
        needsPathsArg: true,
      },
      {
        schemaDir: '',
        schemaFilename: 'schema.prisma',
        needsMove: false,
        needsPathsArg: false,
      },
    ] as const

    for (const { schemaDir, schemaFilename, needsMove, needsPathsArg } of schemaPaths) {
      const schemaPath = path.posix.join(schemaDir, schemaFilename)
      const viewsPath = path.posix.join(schemaDir, 'views')
      const testName = `introspection from ${schemaPath} creates view definition files`

      test(testName, async () => {
        ctx.fixture(fixturePath)

        if (needsMove) {
          await ctx.fs.moveAsync('schema.prisma', schemaPath)
        }

        const introspect = new DbPull()
        const args = needsPathsArg ? ['--schema', `${schemaPath}`] : []
        const result = introspect.parse(args)
        await expect(result).resolves.toMatchInlineSnapshot(``)

        // the folders in `views` match the database schema names (public, work) of the views
        // defined in the `setup.sql` file
        const list = await ctx.fs.listAsync(viewsPath)
        expect(list).toMatchInlineSnapshot(`
          [
            public,
            work,
          ]
        `)

        // showing the folder tree fails on Windows due to path slashes
        if (process.platform !== 'win32') {
          const tree = await ctx.fs.findAsync({
            directories: false,
            files: true,
            recursive: true,
            matching: `${viewsPath}/**/*`,
          })
          expect(tree).toMatchSnapshot()
        }

        const publicSimpleUserView = await ctx.fs.readAsync(`${viewsPath}/public/simpleuser.sql`)
        expect(publicSimpleUserView).toMatchInlineSnapshot(`
          SELECT
            su.first_name,
            su.last_name
          FROM
            someuser su;
        `)

        const workWorkersView = await ctx.fs.readAsync(`${viewsPath}/work/workers.sql`)
        expect(workWorkersView).toMatchInlineSnapshot(`
          SELECT
            su.first_name,
            su.last_name,
            c.name AS company_name
          FROM
            (
              someuser su
              LEFT JOIN WORK.company c ON ((su.company_id = c.id))
            );
        `)

        expect(ctx.mocked['console.log'].mock.calls.join('\n')).toMatchInlineSnapshot(``)
        expect(ctx.mocked['console.info'].mock.calls.join('\n')).toMatchSnapshot()
        expect(ctx.mocked['console.error'].mock.calls.join('\n')).toMatchInlineSnapshot(``)
        expect(ctx.mocked['process.stdout.write'].mock.calls.join('\n')).toMatchSnapshot()
        expect(ctx.mocked['process.stderr.write'].mock.calls.join('\n')).toMatchInlineSnapshot(``)
      })
    }

    test('extraneous files in views folder should be removed on introspect', async () => {
      ctx.fixture(path.join(fixturePath))

      await ctx.fs.dirAsync('views')
      const initialList = await ctx.fs.listAsync('views')
      expect(initialList).toMatchInlineSnapshot(`[]`)

      await ctx.fs.dirAsync('views/extraneous-dir')
      await ctx.fs.fileAsync('views/extraneous-file.sql')
      const extraneousList = await ctx.fs.listAsync('views')
      expect(extraneousList).toMatchInlineSnapshot(`
        [
          extraneous-dir,
          extraneous-file.sql,
        ]
      `)

      const introspect = new DbPull()
      const result = introspect.parse([])
      await expect(result).resolves.toMatchInlineSnapshot(``)

      // the folders in `views` match the database schema names (public, work) of the views
      // defined in the `setup.sql` file
      const list = await ctx.fs.listAsync('views')
      expect(list).toMatchInlineSnapshot(`
        [
          public,
          work,
        ]
      `)

      const tree = await ctx.fs.findAsync({ directories: false, files: true, recursive: true, matching: 'views/**/*' })
      expect(tree).toMatchInlineSnapshot(`
        [
          views/public/simpleuser.sql,
          views/work/workers.sql,
        ]
      `)
    })
  })

  describe('no preview', () => {
    const fixturePath = setupPostgresForViewsIO('no-preview')

    test('basic introspection', async () => {
      ctx.fixture(path.join(fixturePath))

      const introspect = new DbPull()
      const result = introspect.parse([])
      await expect(result).resolves.toMatchInlineSnapshot(``)

      const list = await ctx.fs.listAsync('views')
      expect(list).toMatchInlineSnapshot(`undefined`)

      const tree = await ctx.fs.findAsync({ directories: false, files: true, recursive: true, matching: 'views/**/*' })
      expect(tree).toMatchInlineSnapshot(`[]`)

      expect(ctx.mocked['console.log'].mock.calls.join('\n')).toMatchInlineSnapshot(``)
      expect(ctx.mocked['console.info'].mock.calls.join('\n')).toMatchInlineSnapshot(`
        Prisma schema loaded from schema.prisma
        Datasource "db": PostgreSQL database "tests-migrate-db-pull", schemas "public, work" at "localhost:5432"
      `)
      expect(ctx.mocked['console.error'].mock.calls.join('\n')).toMatchInlineSnapshot(``)
      expect(ctx.mocked['process.stdout.write'].mock.calls.join('\n')).toMatchInlineSnapshot(`


        - Introspecting based on datasource defined in schema.prisma

        ✔ Introspected 2 models and wrote them into schema.prisma in XXXms
              
        Run prisma generate to generate Prisma Client.

      `)
      expect(ctx.mocked['process.stderr.write'].mock.calls.join('\n')).toMatchInlineSnapshot(``)
    })

    test('introspect with already existing files in "views"', async () => {
      ctx.fixture(path.join(fixturePath))

      await ctx.fs.dirAsync('views/extraneous-dir')
      await ctx.fs.fileAsync('views/extraneous-file.sql')
      const extraneousList = await ctx.fs.listAsync('views')
      expect(extraneousList).toMatchInlineSnapshot(`
        [
          extraneous-dir,
          extraneous-file.sql,
        ]
      `)

      const introspect = new DbPull()
      const result = introspect.parse([])
      await expect(result).resolves.toMatchInlineSnapshot(``)

      const list = await ctx.fs.listAsync('views')
      expect(list).toMatchInlineSnapshot(`
        [
          extraneous-dir,
          extraneous-file.sql,
        ]
      `)

      const tree = await ctx.fs.findAsync({ directories: false, files: true, recursive: true, matching: 'views/**/*' })
      expect(tree).toMatchInlineSnapshot(`
        [
          views/extraneous-file.sql,
        ]
      `)
    })
  })
})

describe('postgresql views re-introspection warnings', () => {
  const connectionString = process.env.TEST_POSTGRES_URI_MIGRATE!.replace('tests-migrate', 'tests-migrate-db-pull')

  function computeSetupParams(warningCode: number, variant?: number): SetupParams {
    const setupParams: SetupParams = {
      connectionString,
      // Note: dirname points to a location with a setup.sql file
      // which will be executed to prepare the database with the correct tables, views etc.
      dirname: path.join(
        __dirname,
        '..',
        '__tests__',
        'fixtures',
        're-introspection',
        'postgresql',
        `views-warning-${warningCode}${variant ? `-${variant}` : ''}`,
      ),
    }
    return setupParams
  }

  function setupPostgressForWarning(warningCode: number, variant?: number) {
    const setupParams = computeSetupParams(warningCode, variant)

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

  describe('postgresql views 21/1 - singular unsupported types (both view and model [code 3])', () => {
    const warningCode = 21
    const variant = 1
    setupPostgressForWarning(warningCode, variant)

    test('basic re-introspection', async () => {
      ctx.fixture(`re-introspection/postgresql/views-warning-${warningCode}-${variant}`)
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

        model reservations {
          id    Int                      @id
          room  String                   @db.VarChar
          dates Unsupported("daterange")
        }

        view res {
          id    Int                      @id
          room  String                   @db.VarChar
          dates Unsupported("daterange")
        }


        // introspectionSchemaVersion: NonPrisma,
      `)
      expect(ctx.mocked['console.info'].mock.calls.join('\n')).toMatchInlineSnapshot(``)
      expect(ctx.mocked['console.error'].mock.calls.join('\n')).toMatchInlineSnapshot(`

        // *** WARNING ***
        // 
        // These fields are not supported by the Prisma Client, because Prisma currently does not support their types:
        //   - model: reservations, field: dates, type: daterange
        // 
        // These fields are not supported by the Prisma Client, because Prisma currently does not support their types:
        //   - view: res, field: dates, type: daterange
        // 
      `)
      expect(ctx.mocked['process.stdout.write'].mock.calls.join('\n')).toMatchInlineSnapshot(``)
      expect(ctx.mocked['process.stderr.write'].mock.calls.join('\n')).toMatchInlineSnapshot(``)
    })
  })

  describe('postgresql views 21/2 - multiline unsupported types (both view and model [code 3])', () => {
    const warningCode = 21
    const variant = 2
    setupPostgressForWarning(warningCode, variant)

    test('basic re-introspection', async () => {
      ctx.fixture(`re-introspection/postgresql/views-warning-${warningCode}-${variant}`)
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

        model reservations {
          id    Int                      @id
          room  String                   @db.VarChar
          dates Unsupported("daterange")
        }

        view res {
          id    Int                      @id
          room  String                   @db.VarChar
          dates Unsupported("daterange")
        }

        view dates {
          id    Int                      @id
          dates Unsupported("daterange")
        }


        // introspectionSchemaVersion: NonPrisma,
      `)
      expect(ctx.mocked['console.info'].mock.calls.join('\n')).toMatchInlineSnapshot(``)
      expect(ctx.mocked['console.error'].mock.calls.join('\n')).toMatchInlineSnapshot(`

        // *** WARNING ***
        // 
        // These fields are not supported by the Prisma Client, because Prisma currently does not support their types:
        //   - model: reservations, field: dates, type: daterange
        // 
        // These fields are not supported by the Prisma Client, because Prisma currently does not support their types:
        //   - view: res, field: dates, type: daterange
        //   - view: dates, field: dates, type: daterange
        // 
      `)
      expect(ctx.mocked['process.stdout.write'].mock.calls.join('\n')).toMatchInlineSnapshot(``)
      expect(ctx.mocked['process.stderr.write'].mock.calls.join('\n')).toMatchInlineSnapshot(``)
    })
  })

  describe('postgresql views 22/1 - field with @map', () => {
    const warningCode = 22
    const variant = 1
    setupPostgressForWarning(warningCode, variant)

    test('basic re-introspection', async () => {
      ctx.fixture(`re-introspection/postgresql/views-warning-${warningCode}-${variant}`)
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

        view A {
          id Int @id @map("foo")
        }


        // introspectionSchemaVersion: NonPrisma,
      `)
      expect(ctx.mocked['console.info'].mock.calls.join('\n')).toMatchInlineSnapshot(``)
      expect(ctx.mocked['console.error'].mock.calls.join('\n')).toMatchInlineSnapshot(`

        // *** WARNING ***
        // 
        // These fields were enriched with \`@map\` information taken from the previous Prisma schema:
        //   - view: A, field: id
        // 
      `)
      expect(ctx.mocked['process.stdout.write'].mock.calls.join('\n')).toMatchInlineSnapshot(``)
      expect(ctx.mocked['process.stderr.write'].mock.calls.join('\n')).toMatchInlineSnapshot(``)
    })
  })

  describe('postgresql views 22/2 - field with @map', () => {
    const warningCode = 22
    const variant = 2
    setupPostgressForWarning(warningCode, variant)

    test('basic re-introspection', async () => {
      ctx.fixture(`re-introspection/postgresql/views-warning-${warningCode}-${variant}`)
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

        view A {
          id Int @id @map("foo")
        }

        view B {
          id Int @id @map("bar")
        }


        // introspectionSchemaVersion: NonPrisma,
      `)
      expect(ctx.mocked['console.info'].mock.calls.join('\n')).toMatchInlineSnapshot(``)
      expect(ctx.mocked['console.error'].mock.calls.join('\n')).toMatchInlineSnapshot(`

        // *** WARNING ***
        // 
        // These fields were enriched with \`@map\` information taken from the previous Prisma schema:
        //   - view: A, field: id
        //   - view: B, field: id
        // 
      `)
      expect(ctx.mocked['process.stdout.write'].mock.calls.join('\n')).toMatchInlineSnapshot(``)
      expect(ctx.mocked['process.stderr.write'].mock.calls.join('\n')).toMatchInlineSnapshot(``)
    })
  })

  describe('postgresql views 23 - automated rename with @@map', () => {
    const warningCode = 23
    setupPostgressForWarning(warningCode)

    test('basic re-introspection', async () => {
      ctx.fixture(`re-introspection/postgresql/views-warning-${warningCode}`)
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

        view Renamedif {
          id Int @id

          @@map("if")
        }


        // introspectionSchemaVersion: NonPrisma,
      `)
      expect(ctx.mocked['console.info'].mock.calls.join('\n')).toMatchInlineSnapshot(``)
      expect(ctx.mocked['console.error'].mock.calls.join('\n')).toMatchInlineSnapshot(`

        // *** WARNING ***
        // 
        // These views were enriched with \`@@map\` information taken from the previous Prisma schema:
        //   - Renamedif
        // 
        // These views were enriched with \`@@map\` information taken from the previous Prisma schema:
        //   - Renamedif
        // 
      `)
      expect(ctx.mocked['process.stdout.write'].mock.calls.join('\n')).toMatchInlineSnapshot(``)
      expect(ctx.mocked['process.stderr.write'].mock.calls.join('\n')).toMatchInlineSnapshot(``)
    })
  })

  describe('postgresql views 24 - no unique identifier', () => {
    const warningCode = 24
    setupPostgressForWarning(warningCode)

    test('basic re-introspection', async () => {
      ctx.fixture(`re-introspection/postgresql/views-warning-${warningCode}`)
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

        model User {
          id         Int     @id @default(autoincrement())
          first_name String  @db.VarChar(255)
          last_name  String? @db.VarChar(255)
        }

        /// The underlying view does not contain a valid unique identifier and can therefore currently not be handled by the Prisma Client.
        view Schwuser {
          id         Int?
          first_name String? @db.VarChar(255)
          last_name  String? @db.VarChar(255)

          @@ignore
        }


        // introspectionSchemaVersion: NonPrisma,
      `)
      expect(ctx.mocked['console.info'].mock.calls.join('\n')).toMatchInlineSnapshot(``)
      expect(ctx.mocked['console.error'].mock.calls.join('\n')).toMatchInlineSnapshot(`

        // *** WARNING ***
        // 
        // The following views were ignored as they do not have a valid unique identifier or id. This is currently not supported by the Prisma Client. Please refer to the documentation on defining unique identifiers in views: https://pris.ly/d/view-identifiers
        //   - Schwuser
        // 
      `)
      expect(ctx.mocked['process.stdout.write'].mock.calls.join('\n')).toMatchInlineSnapshot(``)
      expect(ctx.mocked['process.stderr.write'].mock.calls.join('\n')).toMatchInlineSnapshot(``)
    })
  })

  describe('postgresql views 25 - @@id name', () => {
    const warningCode = 25
    setupPostgressForWarning(warningCode)

    test('basic re-introspection', async () => {
      ctx.fixture(`re-introspection/postgresql/views-warning-${warningCode}`)
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

        view B {
          a Int
          b Int

          @@id([a, b], name: "kekw")
        }


        // introspectionSchemaVersion: NonPrisma,
      `)
      expect(ctx.mocked['console.info'].mock.calls.join('\n')).toMatchInlineSnapshot(``)
      expect(ctx.mocked['console.error'].mock.calls.join('\n')).toMatchInlineSnapshot(`

        // *** WARNING ***
        // 
        // These views were enriched with custom compound id names taken from the previous Prisma schema:
        //   - B
        // 
      `)
      expect(ctx.mocked['process.stdout.write'].mock.calls.join('\n')).toMatchInlineSnapshot(``)
      expect(ctx.mocked['process.stderr.write'].mock.calls.join('\n')).toMatchInlineSnapshot(``)
    })
  })

  describe('postgresql views 26 - invalid field name', () => {
    const warningCode = 26
    setupPostgressForWarning(warningCode)

    test('basic re-introspection', async () => {
      ctx.fixture(`re-introspection/postgresql/views-warning-${warningCode}`)
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

        /// The underlying view does not contain a valid unique identifier and can therefore currently not be handled by the Prisma Client.
        view A {
          foo Int?

          /// This field was commented out because of an invalid name. Please provide a valid one that matches [a-zA-Z][a-zA-Z0-9_]*
          // 1 Int? @map("1")
          @@ignore
        }


        // introspectionSchemaVersion: NonPrisma,
      `)
      expect(ctx.mocked['console.info'].mock.calls.join('\n')).toMatchInlineSnapshot(``)
      expect(ctx.mocked['console.error'].mock.calls.join('\n')).toMatchInlineSnapshot(`

        // *** WARNING ***
        // 
        // These fields were commented out because their names are currently not supported by Prisma. Please provide valid ones that match [a-zA-Z][a-zA-Z0-9_]* using the \`@map\` attribute:
        //   - view: A, field: 1
        // 
        // The following views were ignored as they do not have a valid unique identifier or id. This is currently not supported by the Prisma Client. Please refer to the documentation on defining unique identifiers in views: https://pris.ly/d/view-identifiers
        //   - A
        // 
      `)
      expect(ctx.mocked['process.stdout.write'].mock.calls.join('\n')).toMatchInlineSnapshot(``)
      expect(ctx.mocked['process.stderr.write'].mock.calls.join('\n')).toMatchInlineSnapshot(``)
    })
  })
})

describe('postgresql views introspection warnings', () => {
  const connectionString = process.env.TEST_POSTGRES_URI_MIGRATE!.replace('tests-migrate', 'tests-migrate-db-pull')

  function computeSetupParams(warningCode: number, variant?: number): SetupParams {
    const setupParams: SetupParams = {
      connectionString,
      // Note: dirname points to a location with a setup.sql file
      // which will be executed to prepare the database with the correct tables, views etc.
      dirname: path.join(
        __dirname,
        '..',
        '__tests__',
        'fixtures',
        'introspection',
        'postgresql',
        `views-warning-${warningCode}${variant ? `-${variant}` : ''}`,
      ),
    }
    return setupParams
  }

  function setupPostgressForWarning(warningCode: number, variant?: number) {
    const setupParams = computeSetupParams(warningCode, variant)

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

  describe('postgresql views 21 - unsupported types (both view and model [code 3])', () => {
    const warningCode = 21
    setupPostgressForWarning(warningCode)

    test('basic introspection', async () => {
      ctx.fixture(`introspection/postgresql/views-warning-${warningCode}`)
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

        model reservations {
          id    Int                      @id
          room  String                   @db.VarChar
          dates Unsupported("daterange")
        }

        /// The underlying view does not contain a valid unique identifier and can therefore currently not be handled by the Prisma Client.
        view res {
          id    Int?
          room  String?                   @db.VarChar
          dates Unsupported("daterange")?

          @@ignore
        }


        // introspectionSchemaVersion: NonPrisma,
      `)
      expect(ctx.mocked['console.info'].mock.calls.join('\n')).toMatchInlineSnapshot(``)
      expect(ctx.mocked['console.error'].mock.calls.join('\n')).toMatchInlineSnapshot(`

        // *** WARNING ***
        // 
        // The following views were ignored as they do not have a valid unique identifier or id. This is currently not supported by the Prisma Client. Please refer to the documentation on defining unique identifiers in views: https://pris.ly/d/view-identifiers
        //   - res
        // 
        // These fields are not supported by the Prisma Client, because Prisma currently does not support their types:
        //   - model: reservations, field: dates, type: daterange
        // 
        // These fields are not supported by the Prisma Client, because Prisma currently does not support their types:
        //   - view: res, field: dates, type: daterange
        // 
      `)
      expect(ctx.mocked['process.stdout.write'].mock.calls.join('\n')).toMatchInlineSnapshot(``)
      expect(ctx.mocked['process.stderr.write'].mock.calls.join('\n')).toMatchInlineSnapshot(``)
    })
  })

  // * code 22 (automated rename with @map) requires a schema and therefore only appears in re-introspection

  // * code 23 (view with @@map) requires a schema and therefore only appears in re-introspection
  // * there is a similar output that gets appended to the schema during introspection however that is not an official warning

  describe('postgresql views 24/1 - singular no unique identifier', () => {
    const warningCode = 24
    const variant = 1
    setupPostgressForWarning(warningCode, variant)

    test('basic introspection', async () => {
      ctx.fixture(`introspection/postgresql/views-warning-${warningCode}-${variant}`)
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

        model User {
          id         Int     @id @default(autoincrement())
          first_name String  @db.VarChar(255)
          last_name  String? @db.VarChar(255)
        }

        /// The underlying view does not contain a valid unique identifier and can therefore currently not be handled by the Prisma Client.
        view Schwuser {
          id         Int?
          first_name String? @db.VarChar(255)
          last_name  String? @db.VarChar(255)

          @@ignore
        }


        // introspectionSchemaVersion: NonPrisma,
      `)
      expect(ctx.mocked['console.info'].mock.calls.join('\n')).toMatchInlineSnapshot(``)
      expect(ctx.mocked['console.error'].mock.calls.join('\n')).toMatchInlineSnapshot(`

        // *** WARNING ***
        // 
        // The following views were ignored as they do not have a valid unique identifier or id. This is currently not supported by the Prisma Client. Please refer to the documentation on defining unique identifiers in views: https://pris.ly/d/view-identifiers
        //   - Schwuser
        // 
      `)
      expect(ctx.mocked['process.stdout.write'].mock.calls.join('\n')).toMatchInlineSnapshot(``)
      expect(ctx.mocked['process.stderr.write'].mock.calls.join('\n')).toMatchInlineSnapshot(``)
    })
  })

  describe('postgresql views 24/2 - multiple no unique identifier', () => {
    const warningCode = 24
    const variant = 2
    setupPostgressForWarning(warningCode, variant)

    test('basic introspection', async () => {
      ctx.fixture(`introspection/postgresql/views-warning-${warningCode}-${variant}`)
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

        model User {
          id         Int     @id @default(autoincrement())
          first_name String  @db.VarChar(255)
          last_name  String? @db.VarChar(255)
        }

        /// The underlying view does not contain a valid unique identifier and can therefore currently not be handled by the Prisma Client.
        view Schwuser {
          id         Int?
          first_name String? @db.VarChar(255)
          last_name  String? @db.VarChar(255)

          @@ignore
        }

        /// The underlying view does not contain a valid unique identifier and can therefore currently not be handled by the Prisma Client.
        view Names {
          id         Int?
          first_name String? @db.VarChar(255)

          @@ignore
        }


        // introspectionSchemaVersion: NonPrisma,
      `)
      expect(ctx.mocked['console.info'].mock.calls.join('\n')).toMatchInlineSnapshot(``)
      expect(ctx.mocked['console.error'].mock.calls.join('\n')).toMatchInlineSnapshot(`

        // *** WARNING ***
        // 
        // The following views were ignored as they do not have a valid unique identifier or id. This is currently not supported by the Prisma Client. Please refer to the documentation on defining unique identifiers in views: https://pris.ly/d/view-identifiers
        //   - Schwuser
        //   - Names
        // 
      `)
      expect(ctx.mocked['process.stdout.write'].mock.calls.join('\n')).toMatchInlineSnapshot(``)
      expect(ctx.mocked['process.stderr.write'].mock.calls.join('\n')).toMatchInlineSnapshot(``)
    })
  })

  // * code 25 (@@id name) requires a previous schema to keep the @@id names from and therefore only appears in re-introspection

  describe('postgresql views 26 - invalid field name', () => {
    const warningCode = 26
    setupPostgressForWarning(warningCode)

    test('basic introspection', async () => {
      ctx.fixture(`introspection/postgresql/views-warning-${warningCode}`)
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

        /// The underlying view does not contain a valid unique identifier and can therefore currently not be handled by the Prisma Client.
        view A {
          foo Int?

          /// This field was commented out because of an invalid name. Please provide a valid one that matches [a-zA-Z][a-zA-Z0-9_]*
          // 1 Int? @map("1")
          @@ignore
        }


        // introspectionSchemaVersion: NonPrisma,
      `)
      expect(ctx.mocked['console.info'].mock.calls.join('\n')).toMatchInlineSnapshot(``)
      expect(ctx.mocked['console.error'].mock.calls.join('\n')).toMatchInlineSnapshot(`

        // *** WARNING ***
        // 
        // These fields were commented out because their names are currently not supported by Prisma. Please provide valid ones that match [a-zA-Z][a-zA-Z0-9_]* using the \`@map\` attribute:
        //   - view: A, field: 1
        // 
        // The following views were ignored as they do not have a valid unique identifier or id. This is currently not supported by the Prisma Client. Please refer to the documentation on defining unique identifiers in views: https://pris.ly/d/view-identifiers
        //   - A
        // 
      `)
      expect(ctx.mocked['process.stdout.write'].mock.calls.join('\n')).toMatchInlineSnapshot(``)
      expect(ctx.mocked['process.stderr.write'].mock.calls.join('\n')).toMatchInlineSnapshot(``)
    })
  })
})

describe('postgresql introspection stopgaps', () => {
  const connectionString = process.env.TEST_POSTGRES_URI_MIGRATE!.replace('tests-migrate', 'tests-migrate-db-pull')

  const computeSetupParams = (stopGap: string, warningCode: number, variant?: number): SetupParams => {
    const setupParams: SetupParams = {
      connectionString,
      // Note: dirname points to a location with a setup.sql file
      // which will be executed to prepare the database with the correct tables, views etc.
      dirname: path.join(
        __dirname,
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
          //   - measurement
          // 
          // These tables are partition tables, which are not yet fully supported:
          //   - measurement
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
          //   - definitely_not_measurement
          //   - measurement
          // 
          // These tables are partition tables, which are not yet fully supported:
          //   - definitely_not_measurement
          //   - measurement
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
        //   - index: idx_a, column: a
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
        //   - foo
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
        //   - model: a, constraint: foo_key
        //   - model: a, constraint: foo_pkey
        //   - model: a, constraint: a_b_fk
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
          //   - type: model, name: a
          //   - type: field, name: a.val
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
          //   - b
          // 
          // These objects have comments defined in the database, which is not yet fully supported. Read more: https://pris.ly/d/database-comments
          //   - type: view, name: b
          //   - type: field, name: b.val
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
          //   - type: enum, name: c
          // 
        `)
        expect(ctx.mocked['process.stdout.write'].mock.calls.join('\n')).toMatchInlineSnapshot(``)
        expect(ctx.mocked['process.stderr.write'].mock.calls.join('\n')).toMatchInlineSnapshot(``)
      })
    })
  })
})

describe('postgresql', () => {
  const connectionString = process.env.TEST_POSTGRES_URI_MIGRATE!.replace('tests-migrate', 'tests-migrate-db-pull')

  const setupParams: SetupParams = {
    connectionString,
    // Note: at this location there is a setup.sql file
    // which will be executed a SQL file so the database is not empty
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
      Datasource "db": PostgreSQL database "tests-migrate-db-pull", schema "public" at "localhost:5432"
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

describe('postgresql-multi-schema', () => {
  const connectionString = process.env.TEST_POSTGRES_URI_MIGRATE!.replace(
    'tests-migrate',
    'tests-migrate-db-pull-multischema',
  )

  const setupParams: SetupParams = {
    connectionString,
    // Note: at this location there is a setup.sql file
    // which will be executed a SQL file so the database is not empty
    dirname: path.join(__dirname, '..', '__tests__', 'fixtures', 'introspection', 'postgresql-multi-schema'),
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

  test('without datasource property `schemas` it should error with P4001, empty database', async () => {
    ctx.fixture('introspection/postgresql-multi-schema')
    const introspect = new DbPull()
    const result = introspect.parse(['--print', '--schema', 'without-schemas-in-datasource.prisma'])
    await expect(result).rejects.toThrow(`P4001`)
    expect(ctx.mocked['console.log'].mock.calls.join('\n')).toMatchInlineSnapshot(``)
    expect(ctx.mocked['console.info'].mock.calls.join('\n')).toMatchInlineSnapshot(``)
    expect(ctx.mocked['console.error'].mock.calls.join('\n')).toMatchInlineSnapshot(``)
    expect(ctx.mocked['process.stdout.write'].mock.calls.join('\n')).toMatchInlineSnapshot(``)
    expect(ctx.mocked['process.stderr.write'].mock.calls.join('\n')).toMatchInlineSnapshot(``)
  })

  test('datasource property `schemas=[]` should error with P1012, array can not be empty', async () => {
    ctx.fixture('introspection/postgresql-multi-schema')
    const introspect = new DbPull()
    const result = introspect.parse(['--print', '--schema', 'with-schemas-in-datasource-0-value.prisma'])
    await expect(result).rejects.toMatchInlineSnapshot(`
      Prisma schema validation - (get-config wasm)
      Error code: P1012
      error: If provided, the schemas array can not be empty.
        -->  schema.prisma:4
         | 
       3 |   url      = env("TEST_POSTGRES_URI_MIGRATE")
       4 |   schemas  = []
         | 

      Validation Error Count: 1
      [Context: getConfig]

      Prisma CLI Version : 0.0.0
    `)
    expect(ctx.mocked['console.log'].mock.calls.join('\n')).toMatchInlineSnapshot(``)
    expect(ctx.mocked['console.info'].mock.calls.join('\n')).toMatchInlineSnapshot(``)
    expect(ctx.mocked['console.error'].mock.calls.join('\n')).toMatchInlineSnapshot(``)
    expect(ctx.mocked['process.stdout.write'].mock.calls.join('\n')).toMatchInlineSnapshot(``)
    expect(ctx.mocked['process.stderr.write'].mock.calls.join('\n')).toMatchInlineSnapshot(``)
  })

  test('datasource property `schemas=["base", "transactional"]` should succeed', async () => {
    ctx.fixture('introspection/postgresql-multi-schema')
    const introspect = new DbPull()
    const result = introspect.parse(['--print', '--schema', 'with-schemas-in-datasource-2-values.prisma'])
    await expect(result).resolves.toMatchInlineSnapshot(``)
    expect(ctx.mocked['console.log'].mock.calls.join('\n')).toMatchSnapshot()
    expect(ctx.mocked['console.info'].mock.calls.join('\n')).toMatchInlineSnapshot(``)
    expect(ctx.mocked['console.error'].mock.calls.join('\n')).toMatchInlineSnapshot(`

      // *** WARNING ***
      // 
      // These items were renamed due to their names being duplicates in the Prisma Schema Language:
      //   - type: enum, name: base_status
      //   - type: enum, name: transactional_status
      //   - type: model, name: base_some_table
      //   - type: model, name: transactional_some_table
      // 
    `)
    expect(ctx.mocked['process.stdout.write'].mock.calls.join('\n')).toMatchInlineSnapshot(``)
    expect(ctx.mocked['process.stderr.write'].mock.calls.join('\n')).toMatchInlineSnapshot(``)
  })

  test('datasource property `schemas=["base"]` should succeed', async () => {
    ctx.fixture('introspection/postgresql-multi-schema')
    const introspect = new DbPull()
    const result = introspect.parse(['--print', '--schema', 'with-schemas-in-datasource-1-value.prisma'])
    await expect(result).resolves.toMatchInlineSnapshot(``)
    expect(ctx.mocked['console.log'].mock.calls.join('\n')).toMatchSnapshot()
    expect(ctx.mocked['console.info'].mock.calls.join('\n')).toMatchInlineSnapshot(``)
    expect(ctx.mocked['console.error'].mock.calls.join('\n')).toMatchInlineSnapshot(``)
    expect(ctx.mocked['process.stdout.write'].mock.calls.join('\n')).toMatchInlineSnapshot(``)
    expect(ctx.mocked['process.stderr.write'].mock.calls.join('\n')).toMatchInlineSnapshot(``)
  })

  test('datasource property `schemas=["does-not-exist"]` should error with P4001, empty database', async () => {
    ctx.fixture('introspection/postgresql-multi-schema')
    const introspect = new DbPull()
    const result = introspect.parse(['--print', '--schema', 'with-schemas-in-datasource-1-non-existing-value.prisma'])
    await expect(result).rejects.toThrow(`P4001`)
    expect(ctx.mocked['console.log'].mock.calls.join('\n')).toMatchSnapshot()
    expect(ctx.mocked['console.info'].mock.calls.join('\n')).toMatchInlineSnapshot(``)
    expect(ctx.mocked['console.error'].mock.calls.join('\n')).toMatchInlineSnapshot(``)
    expect(ctx.mocked['process.stdout.write'].mock.calls.join('\n')).toMatchInlineSnapshot(``)
    expect(ctx.mocked['process.stderr.write'].mock.calls.join('\n')).toMatchInlineSnapshot(``)
  })

  test('datasource property `schemas=["does-not-exist", "base"]` should succeed', async () => {
    ctx.fixture('introspection/postgresql-multi-schema')
    const introspect = new DbPull()
    const result = introspect.parse([
      '--print',
      '--schema',
      'with-schemas-in-datasource-1-existing-1-non-existing-value.prisma',
    ])
    await expect(result).resolves.toMatchInlineSnapshot(``)
    expect(ctx.mocked['console.log'].mock.calls.join('\n')).toMatchSnapshot()
    expect(ctx.mocked['console.info'].mock.calls.join('\n')).toMatchInlineSnapshot(``)
    expect(ctx.mocked['console.error'].mock.calls.join('\n')).toMatchInlineSnapshot(``)
    expect(ctx.mocked['process.stdout.write'].mock.calls.join('\n')).toMatchInlineSnapshot(``)
    expect(ctx.mocked['process.stderr.write'].mock.calls.join('\n')).toMatchInlineSnapshot(``)
  })

  test('--url with --schemas=base without preview feature should error', async () => {
    ctx.fixture('introspection/postgresql-multi-schema')
    ctx.fs.remove(`./schema.prisma`)

    const introspect = new DbPull()
    const result = introspect.parse(['--print', '--url', setupParams.connectionString, '--schemas', 'base'])
    await expect(result).rejects.toThrowErrorMatchingInlineSnapshot(`
      The preview feature \`multiSchema\` must be enabled before using --schemas command line parameter.


    `)
    expect(ctx.mocked['console.log'].mock.calls.join('\n')).toMatchSnapshot()
    expect(ctx.mocked['console.info'].mock.calls.join('\n')).toMatchInlineSnapshot(``)
    expect(ctx.mocked['console.error'].mock.calls.join('\n')).toMatchInlineSnapshot(``)
    expect(ctx.mocked['process.stdout.write'].mock.calls.join('\n')).toMatchInlineSnapshot(``)
    expect(ctx.mocked['process.stderr.write'].mock.calls.join('\n')).toMatchInlineSnapshot(``)
  })

  test('--url with --schemas=does-not-exist should error', async () => {
    ctx.fixture('introspection/postgresql-multi-schema')

    const introspect = new DbPull()
    const result = introspect.parse(['--print', '--url', setupParams.connectionString, '--schemas', 'does-not-exist'])
    await expect(result).rejects.toThrowErrorMatchingInlineSnapshot(`

      P4001 The introspected database was empty: postgres://prisma:prisma@localhost:5432/tests-migrate-db-pull-multischema

      prisma db pull could not create any models in your schema.prisma file and you will not be able to generate Prisma Client with the prisma generate command.

      To fix this, you have two options:

      - manually create a table in your database.
      - make sure the database connection URL inside the datasource block in schema.prisma points to a database that is not empty (it must contain at least one table).

      Then you can run prisma db pull again. 

    `)
    expect(ctx.mocked['console.log'].mock.calls.join('\n')).toMatchSnapshot()
    expect(ctx.mocked['console.info'].mock.calls.join('\n')).toMatchInlineSnapshot(``)
    expect(ctx.mocked['console.error'].mock.calls.join('\n')).toMatchInlineSnapshot(``)
    expect(ctx.mocked['process.stdout.write'].mock.calls.join('\n')).toMatchInlineSnapshot(``)
    expect(ctx.mocked['process.stderr.write'].mock.calls.join('\n')).toMatchInlineSnapshot(``)
  })

  test('--url --schemas=base (1 existing schema) should succeed', async () => {
    ctx.fixture('introspection/postgresql-multi-schema')

    const introspect = new DbPull()
    const result = introspect.parse(['--print', '--url', setupParams.connectionString, '--schemas', 'base'])
    await expect(result).resolves.toMatchInlineSnapshot(``)
    expect(ctx.mocked['console.log'].mock.calls.join('\n')).toMatchSnapshot()
    expect(ctx.mocked['console.info'].mock.calls.join('\n')).toMatchInlineSnapshot(``)
    expect(ctx.mocked['console.error'].mock.calls.join('\n')).toMatchInlineSnapshot(``)
    expect(ctx.mocked['process.stdout.write'].mock.calls.join('\n')).toMatchInlineSnapshot(``)
    expect(ctx.mocked['process.stderr.write'].mock.calls.join('\n')).toMatchInlineSnapshot(``)
  })

  test('--url  --schemas=base,transactional (2 existing schemas) should succeed', async () => {
    ctx.fixture('introspection/postgresql-multi-schema')

    const introspect = new DbPull()
    const result = introspect.parse([
      '--print',
      '--url',
      setupParams.connectionString,
      '--schemas',
      'base,transactional',
    ])
    await expect(result).resolves.toMatchInlineSnapshot(``)
    expect(ctx.mocked['console.log'].mock.calls.join('\n')).toMatchSnapshot()
    expect(ctx.mocked['console.info'].mock.calls.join('\n')).toMatchInlineSnapshot(``)
    expect(ctx.mocked['console.error'].mock.calls.join('\n')).toMatchInlineSnapshot(`

      // *** WARNING ***
      // 
      // These items were renamed due to their names being duplicates in the Prisma Schema Language:
      //   - type: enum, name: base_status
      //   - type: enum, name: transactional_status
      //   - type: model, name: base_some_table
      //   - type: model, name: transactional_some_table
      // 
    `)
    expect(ctx.mocked['process.stdout.write'].mock.calls.join('\n')).toMatchInlineSnapshot(``)
    expect(ctx.mocked['process.stderr.write'].mock.calls.join('\n')).toMatchInlineSnapshot(``)
  })

  test('--url  --schemas=base,does-not-exist (1 existing schemas + 1 non-existing) should succeed', async () => {
    ctx.fixture('introspection/postgresql-multi-schema')

    const introspect = new DbPull()
    const result = introspect.parse([
      '--print',
      '--url',
      setupParams.connectionString,
      '--schemas',
      'base,does-not-exist',
    ])
    await expect(result).resolves.toMatchInlineSnapshot(``)
    expect(ctx.mocked['console.log'].mock.calls.join('\n')).toMatchSnapshot()
    expect(ctx.mocked['console.info'].mock.calls.join('\n')).toMatchInlineSnapshot(``)
    expect(ctx.mocked['console.error'].mock.calls.join('\n')).toMatchInlineSnapshot(``)
    expect(ctx.mocked['process.stdout.write'].mock.calls.join('\n')).toMatchInlineSnapshot(``)
    expect(ctx.mocked['process.stderr.write'].mock.calls.join('\n')).toMatchInlineSnapshot(``)
  })

  test('--url with --schemas=["does-not-exist", "base"] should error', async () => {
    ctx.fixture('introspection/postgresql-multi-schema')

    const introspect = new DbPull()
    const result = introspect.parse(['--print', '--url', setupParams.connectionString, '--schemas', 'base'])
    await expect(result).resolves.toMatchInlineSnapshot(``)
    expect(ctx.mocked['console.log'].mock.calls.join('\n')).toMatchSnapshot()
    expect(ctx.mocked['console.info'].mock.calls.join('\n')).toMatchInlineSnapshot(``)
    expect(ctx.mocked['console.error'].mock.calls.join('\n')).toMatchInlineSnapshot(``)
    expect(ctx.mocked['process.stdout.write'].mock.calls.join('\n')).toMatchInlineSnapshot(``)
    expect(ctx.mocked['process.stderr.write'].mock.calls.join('\n')).toMatchInlineSnapshot(``)
  })

  test('--url with `?schema=does-not-exist` should error with with P4001, empty database', async () => {
    const introspect = new DbPull()
    // postgres://prisma:prisma@localhost:5432/tests-migrate?schema=does-not-exist
    const connectionString = `${setupParams.connectionString}?schema=does-not-exist`
    const result = introspect.parse(['--print', '--url', connectionString])
    await expect(result).rejects.toThrow(`P4001`)
    expect(ctx.mocked['console.log'].mock.calls.join('\n')).toMatchSnapshot()
    expect(ctx.mocked['console.info'].mock.calls.join('\n')).toMatchInlineSnapshot(``)
    expect(ctx.mocked['console.error'].mock.calls.join('\n')).toMatchInlineSnapshot(``)
    expect(ctx.mocked['process.stdout.write'].mock.calls.join('\n')).toMatchInlineSnapshot(``)
    expect(ctx.mocked['process.stderr.write'].mock.calls.join('\n')).toMatchInlineSnapshot(``)
  })

  test('--url with `?schema=base` should succeed', async () => {
    const introspect = new DbPull()
    // postgres://prisma:prisma@localhost:5432/tests-migrate?schema=base
    const connectionString = `${setupParams.connectionString}?schema=base`
    const result = introspect.parse(['--print', '--url', connectionString])
    await expect(result).resolves.toMatchInlineSnapshot(``)
    expect(ctx.mocked['console.log'].mock.calls.join('\n')).toMatchSnapshot()
    expect(ctx.mocked['console.info'].mock.calls.join('\n')).toMatchInlineSnapshot(``)
    expect(ctx.mocked['console.error'].mock.calls.join('\n')).toMatchInlineSnapshot(``)
    expect(ctx.mocked['process.stdout.write'].mock.calls.join('\n')).toMatchInlineSnapshot(``)
    expect(ctx.mocked['process.stderr.write'].mock.calls.join('\n')).toMatchInlineSnapshot(``)
  })
})

describe('postgresql-extensions', () => {
  const connectionString = process.env.TEST_POSTGRES_URI_MIGRATE!.replace(
    'tests-migrate',
    'tests-migrate-db-pull-extensions',
  )

  const setupParams: SetupParams = {
    connectionString,
    // Note: at this location there is a setup.sql file
    // which will be executed a SQL file so the database is not empty
    dirname: path.join(__dirname, '..', '__tests__', 'fixtures', 'introspection', 'postgresql-extensions'),
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

  test('introspection should succeed and add extensions property to the schema.prisma file', async () => {
    ctx.fixture('introspection/postgresql-extensions')
    const introspect = new DbPull()
    const result = introspect.parse(['--print', '--schema', 'schema.prisma'])
    await expect(result).resolves.toMatchInlineSnapshot(``)
    const introspectedSchema = ctx.mocked['console.log'].mock.calls.join('\n')
    expect(introspectedSchema).toMatchInlineSnapshot(`
      generator client {
        provider        = "prisma-client-js"
        previewFeatures = ["postgresqlExtensions"]
      }

      datasource db {
        provider   = "postgresql"
        url        = env("TEST_POSTGRES_URI_MIGRATE")
        extensions = [citext(schema: "public")]
      }

      model Post {
        id        String    @id
        createdAt DateTime  @default(now())
        updatedAt DateTime  @default(dbgenerated("'1970-01-01 00:00:00'::timestamp without time zone"))
        published Boolean   @default(false)
        title     String
        content   String?
        authorId  String?
        jsonData  Json?
        coinflips Boolean[]
        User      User?     @relation(fields: [authorId], references: [id])
      }

      model User {
        id    String  @id
        email String  @unique(map: "User.email")
        name  String?
        Post  Post[]
      }

      enum Role {
        USER
        ADMIN
      }


      // introspectionSchemaVersion: NonPrisma,
    `)
    expect(introspectedSchema).toContain('[citext(schema:')
    expect(ctx.mocked['console.info'].mock.calls.join('\n')).toMatchInlineSnapshot(``)
    expect(ctx.mocked['console.error'].mock.calls.join('\n')).toMatchInlineSnapshot(``)
    expect(ctx.mocked['process.stdout.write'].mock.calls.join('\n')).toMatchInlineSnapshot(``)
    expect(ctx.mocked['process.stderr.write'].mock.calls.join('\n')).toMatchInlineSnapshot(``)
  })

  test('re-introspection should succeed and keep defined extension in schema.prisma file', async () => {
    ctx.fixture('introspection/postgresql-extensions')
    const introspect = new DbPull()
    const result = introspect.parse(['--print', '--schema', 'schema-extensions-citext.prisma'])
    await expect(result).resolves.toMatchInlineSnapshot(``)
    const introspectedSchema = ctx.mocked['console.log'].mock.calls.join('\n')
    expect(introspectedSchema).toMatchInlineSnapshot(`
      generator client {
        provider        = "prisma-client-js"
        previewFeatures = ["postgresqlExtensions"]
      }

      datasource db {
        provider   = "postgresql"
        url        = env("TEST_POSTGRES_URI_MIGRATE")
        extensions = [citext(schema: "public")]
      }

      model Post {
        id        String    @id
        createdAt DateTime  @default(now())
        updatedAt DateTime  @default(dbgenerated("'1970-01-01 00:00:00'::timestamp without time zone"))
        published Boolean   @default(false)
        title     String
        content   String?
        authorId  String?
        jsonData  Json?
        coinflips Boolean[]
        User      User?     @relation(fields: [authorId], references: [id])
      }

      model User {
        id    String  @id
        email String  @unique(map: "User.email")
        name  String?
        Post  Post[]
      }

      enum Role {
        USER
        ADMIN
      }


      // introspectionSchemaVersion: NonPrisma,
    `)
    expect(introspectedSchema).toContain('[citext(schema:')
    expect(ctx.mocked['console.info'].mock.calls.join('\n')).toMatchInlineSnapshot(``)
    expect(ctx.mocked['console.error'].mock.calls.join('\n')).toMatchInlineSnapshot(``)
    expect(ctx.mocked['process.stdout.write'].mock.calls.join('\n')).toMatchInlineSnapshot(``)
    expect(ctx.mocked['process.stderr.write'].mock.calls.join('\n')).toMatchInlineSnapshot(``)
  })
})

describeIf(!process.env.TEST_SKIP_COCKROACHDB)('cockroachdb', () => {
  if (!process.env.TEST_SKIP_COCKROACHDB && !process.env.TEST_COCKROACH_URI_MIGRATE) {
    throw new Error('You must set a value for process.env.TEST_COCKROACH_URI_MIGRATE. See TESTING.md')
  }
  const connectionString = process.env.TEST_COCKROACH_URI_MIGRATE?.replace('tests-migrate', 'tests-migrate-db-pull')

  const setupParams = {
    connectionString: connectionString!,
    // Note: at this location there is a setup.sql file
    // which will be executed a SQL file so the database is not empty
    dirname: path.join(__dirname, '..', '__tests__', 'fixtures', 'introspection', 'cockroachdb'),
  }

  beforeAll(async () => {
    await tearDownCockroach(setupParams).catch((e) => {
      console.error(e)
    })
  })

  beforeEach(async () => {
    await setupCockroach(setupParams).catch((e) => {
      console.error(e)
    })
    // Back to original env vars
    process.env = { ...originalEnv }
    // Update env var because it's the one that is used in the schemas tested
    process.env.TEST_COCKROACH_URI_MIGRATE = connectionString
  })

  afterEach(async () => {
    // Back to original env vars
    process.env = { ...originalEnv }
    await tearDownCockroach(setupParams).catch((e) => {
      console.error(e)
    })
  })

  test('basic introspection (with cockroachdb provider)', async () => {
    ctx.fixture('introspection/cockroachdb')
    const introspect = new DbPull()
    const result = introspect.parse(['--print'])
    await expect(result).resolves.toMatchInlineSnapshot(``)
    expect(ctx.mocked['console.log'].mock.calls.join('\n')).toMatchSnapshot()
    expect(ctx.mocked['console.info'].mock.calls.join('\n')).toMatchInlineSnapshot(``)
    expect(ctx.mocked['console.error'].mock.calls.join('\n')).toMatchInlineSnapshot(``)
  })

  test('basic introspection (with postgresql provider)', async () => {
    ctx.fixture('introspection/cockroachdb')
    const introspect = new DbPull()
    const result = introspect.parse(['--print', '--schema', 'with-postgresql-provider.prisma'])
    await expect(result).resolves.toMatchInlineSnapshot(``)
    expect(ctx.mocked['console.log'].mock.calls.join('\n')).toMatchSnapshot()
    expect(ctx.mocked['console.info'].mock.calls.join('\n')).toMatchInlineSnapshot(``)
    expect(ctx.mocked['console.error'].mock.calls.join('\n')).toMatchInlineSnapshot(``)
  })

  test('basic introspection (no schema) --url', async () => {
    ctx.fixture('introspection/cockroachdb')
    const introspect = new DbPull()
    const result = introspect.parse(['--print', '--url', setupParams.connectionString])
    await expect(result).resolves.toMatchInlineSnapshot(``)
    expect(ctx.mocked['console.log'].mock.calls.join('\n')).toMatchSnapshot()
    expect(ctx.mocked['console.info'].mock.calls.join('\n')).toMatchInlineSnapshot(``)
    expect(ctx.mocked['console.error'].mock.calls.join('\n')).toMatchInlineSnapshot(``)
  })

  test('basic introspection (with cockroach provider) --url ', async () => {
    ctx.fixture('introspection/cockroachdb')
    const introspect = new DbPull()
    const result = introspect.parse(['--print', '--url', setupParams.connectionString])
    await expect(result).resolves.toMatchInlineSnapshot(``)
    expect(ctx.mocked['console.log'].mock.calls.join('\n')).toMatchSnapshot()
    expect(ctx.mocked['console.info'].mock.calls.join('\n')).toMatchInlineSnapshot(``)
    expect(ctx.mocked['console.error'].mock.calls.join('\n')).toMatchInlineSnapshot(``)
  })

  test('basic introspection (with cockroach provider) --url ', async () => {
    ctx.fixture('introspection/cockroachdb')
    const introspect = new DbPull()
    const result = introspect.parse([
      '--print',
      '--url',
      setupParams.connectionString,
      '--schema',
      'with-postgresql-provider.prisma',
    ])
    await expect(result).resolves.toMatchInlineSnapshot(``)
    expect(ctx.mocked['console.log'].mock.calls.join('\n')).toMatchSnapshot()
    expect(ctx.mocked['console.info'].mock.calls.join('\n')).toMatchInlineSnapshot(``)
    expect(ctx.mocked['console.error'].mock.calls.join('\n')).toMatchInlineSnapshot(``)
  })
})

describeIf(!process.env.TEST_SKIP_COCKROACHDB)('cockroachdb stopgaps', () => {
  if (!process.env.TEST_SKIP_COCKROACHDB && !process.env.TEST_COCKROACH_URI_MIGRATE) {
    throw new Error('You must set a value for process.env.TEST_COCKROACH_URI_MIGRATE. See TESTING.md')
  }

  const connectionString = process.env.TEST_COCKROACH_URI_MIGRATE?.replace('tests-migrate', 'tests-migrate-db-pull')

  const computeSetupParams = (stopGap: string, warningCode: number, variant?: number): SetupParams => {
    const setupParams: SetupParams = {
      connectionString: connectionString!,
      // Note: dirname points to a location with a setup.sql file
      // which will be executed to prepare the database with the correct tables, views etc.
      dirname: path.join(
        __dirname,
        '..',
        '__tests__',
        'fixtures',
        'introspection',
        'cockroachdb',
        `${stopGap}-warning-${warningCode}${variant ? `-${variant}` : ''}`,
      ),
    }
    return setupParams
  }

  const setupCockroachForWarning = (stopGap: string, warningCode: number, variant?: number) => {
    const setupParams = computeSetupParams(stopGap, warningCode, variant)

    beforeEach(async () => {
      await setupCockroach(setupParams)

      // Back to original env vars
      process.env = { ...originalEnv }
      // Update env var because it's the one that is used in the schemas tested
      process.env.TEST_COCKROACH_URI_MIGRATE = connectionString
    })

    afterEach(async () => {
      // Back to original env vars
      process.env = { ...originalEnv }
      await tearDownPostgres(setupParams).catch((e) => {
        console.error(e)
      })
    })
  }

  describe('warning 31 - row ttl found', () => {
    const stopGap = 'row-ttl'
    const warningCode = 31
    setupCockroachForWarning(stopGap, warningCode)

    test('basic introspection', async () => {
      ctx.fixture(`introspection/cockroachdb/${stopGap}-warning-${warningCode}`)
      const introspect = new DbPull()
      const result = introspect.parse(['--print'])

      await expect(result).resolves.toMatchInlineSnapshot(``)

      expect(ctx.mocked['console.log'].mock.calls.join('\n')).toMatchInlineSnapshot(`
        generator client {
          provider = "prisma-client-js"
        }

        datasource db {
          provider = "cockroachdb"
          url      = env("TEST_COCKROACH_URI_MIGRATE")
        }

        /// This model is using a row level TTL in the database, and requires an additional setup in migrations. Read more: https://pris.ly/d/row-level-ttl
        model ttl_test {
          id          BigInt    @id @default(autoincrement())
          inserted_at DateTime? @default(now()) @db.Timestamp(6)
        }


        // introspectionSchemaVersion: NonPrisma,
      `)
      expect(ctx.mocked['console.info'].mock.calls.join('\n')).toMatchInlineSnapshot(``)
      expect(ctx.mocked['console.error'].mock.calls.join('\n')).toMatchInlineSnapshot(`

        // *** WARNING ***
        // 
        // These models are using a row level TTL setting defined in the database, which is not yet fully supported. Read more: https://pris.ly/d/row-level-ttl
        //   - ttl_test
        // 
      `)
      expect(ctx.mocked['process.stdout.write'].mock.calls.join('\n')).toMatchInlineSnapshot(``)
      expect(ctx.mocked['process.stderr.write'].mock.calls.join('\n')).toMatchInlineSnapshot(``)
    })
  })

  describe('warning 36/5 - comments found: models & fields', () => {
    const stopGap = 'comments'
    const warningCode = 36
    const variant = 5
    setupCockroachForWarning(stopGap, warningCode, variant)

    test('basic introspection', async () => {
      ctx.fixture(`introspection/cockroachdb/${stopGap}-warning-${warningCode}-${variant}`)
      const introspect = new DbPull()
      const result = introspect.parse(['--print'])

      await expect(result).resolves.toMatchInlineSnapshot(``)

      expect(ctx.mocked['console.log'].mock.calls.join('\n')).toMatchInlineSnapshot(`
        generator client {
          provider = "prisma-client-js"
        }

        datasource db {
          provider = "postgres"
          url      = env("TEST_COCKROACH_URI_MIGRATE")
        }

        /// This model or at least one of its fields has comments in the database, and requires an additional setup for migrations: Read more: https://pris.ly/d/database-comments
        model a {
          id  BigInt  @id
          val String? @db.VarChar(20)
        }


        // introspectionSchemaVersion: NonPrisma,
      `)
      expect(ctx.mocked['console.info'].mock.calls.join('\n')).toMatchInlineSnapshot(``)
      expect(ctx.mocked['console.error'].mock.calls.join('\n')).toMatchInlineSnapshot(`

        // *** WARNING ***
        // 
        // These objects have comments defined in the database, which is not yet fully supported. Read more: https://pris.ly/d/database-comments
        //   - type: model, name: a
        //   - type: field, name: a.val
        // 
      `)
      expect(ctx.mocked['process.stdout.write'].mock.calls.join('\n')).toMatchInlineSnapshot(``)
      expect(ctx.mocked['process.stderr.write'].mock.calls.join('\n')).toMatchInlineSnapshot(``)
    })
  })
})

describe('mysql', () => {
  const connectionString = process.env.TEST_MYSQL_URI!.replace('tests-migrate', 'tests-migrate-db-pull')

  const setupParams: SetupParams = {
    connectionString: process.env.TEST_MYSQL_URI!,
    // Note: at this location there is a setup.sql file
    // which will be executed a SQL file so the database is not empty
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
    // Back to original env vars
    process.env = { ...originalEnv }
    // Update env var because it's the one that is used in the schemas tested
    process.env.TEST_MYSQL_URI_MIGRATE = connectionString
  })

  afterEach(async () => {
    // Back to original env vars
    process.env = { ...originalEnv }
    await tearDownMysql(setupParams).catch((e) => {
      console.error(e)
    })
  })

  test('basic introspection', async () => {
    ctx.fixture('introspection/mysql')
    const introspect = new DbPull()
    const result = introspect.parse(['--print'])
    await expect(result).resolves.toMatchInlineSnapshot(``)
    expect(ctx.mocked['console.log'].mock.calls.join('\n')).toMatchSnapshot()
    expect(ctx.mocked['console.info'].mock.calls.join('\n')).toMatchInlineSnapshot(``)
    expect(ctx.mocked['console.error'].mock.calls.join('\n')).toMatchInlineSnapshot(``)
    expect(ctx.mocked['process.stdout.write'].mock.calls.join('\n')).toMatchInlineSnapshot(``)
    expect(ctx.mocked['process.stderr.write'].mock.calls.join('\n')).toMatchInlineSnapshot(``)
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
    expect(ctx.mocked['process.stdout.write'].mock.calls.join('\n')).toMatchInlineSnapshot(``)
    expect(ctx.mocked['process.stderr.write'].mock.calls.join('\n')).toMatchInlineSnapshot(``)
  })
})

describe('mysql introspection stopgaps', () => {
  const connectionString = process.env.TEST_MYSQL_URI_MIGRATE!.replace('tests-migrate', 'tests-migrate-db-pull')

  const computeSetupParams = (stopGap: string, warningCode: number, variant?: number): SetupParams => {
    const setupParams: SetupParams = {
      connectionString,
      // Note: dirname points to a location with a setup.sql file
      // which will be executed to prepare the database with the correct tables, views etc.
      dirname: path.join(
        __dirname,
        '..',
        '__tests__',
        'fixtures',
        'introspection',
        'mysql',
        `${stopGap}-warning-${warningCode}${variant ? `-${variant}` : ''}`,
      ),
    }
    return setupParams
  }

  const setupMysqlForWarning = (stopGap: string, warningCode: number, variant?: number) => {
    const setupParams = computeSetupParams(stopGap, warningCode, variant)

    beforeEach(async () => {
      await setupMysql(setupParams)

      // Back to original env vars
      process.env = { ...originalEnv }
      // Update env var because it's the one that is used in the schemas tested
      process.env.TEST_MYSQL_URI_MIGRATE = connectionString
    })

    afterEach(async () => {
      // Back to original env vars
      process.env = { ...originalEnv }
      await tearDownMysql(setupParams).catch((e) => {
        console.error(e)
      })
    })
  }

  describe('warning 36/4 - comments found: models & fields', () => {
    const stopGap = 'comments'
    const warningCode = 36
    const variant = 4
    setupMysqlForWarning(stopGap, warningCode, variant)

    test('basic introspection', async () => {
      ctx.fixture(`introspection/mysql/${stopGap}-warning-${warningCode}-${variant}`)
      const introspect = new DbPull()
      const result = introspect.parse(['--print'])

      await expect(result).resolves.toMatchInlineSnapshot(``)

      expect(ctx.mocked['console.log'].mock.calls.join('\n')).toMatchInlineSnapshot(`
        generator client {
          provider = "prisma-client-js"
        }

        datasource db {
          provider = "mysql"
          url      = env("TEST_MYSQL_URI_MIGRATE")
        }

        /// This model or at least one of its fields has comments in the database, and requires an additional setup for migrations: Read more: https://pris.ly/d/database-comments
        model a {
          id Int  @id @default(autoincrement())
          a  Int?
        }


        // introspectionSchemaVersion: NonPrisma,
      `)
      expect(ctx.mocked['console.info'].mock.calls.join('\n')).toMatchInlineSnapshot(``)
      expect(ctx.mocked['console.error'].mock.calls.join('\n')).toMatchInlineSnapshot(`

        // *** WARNING ***
        // 
        // These objects have comments defined in the database, which is not yet fully supported. Read more: https://pris.ly/d/database-comments
        //   - type: model, name: a
        //   - type: field, name: a.a
        // 
      `)
      expect(ctx.mocked['process.stdout.write'].mock.calls.join('\n')).toMatchInlineSnapshot(``)
      expect(ctx.mocked['process.stderr.write'].mock.calls.join('\n')).toMatchInlineSnapshot(``)
    })
  })
})

describeIf(!process.env.TEST_SKIP_MSSQL)('SQL Server', () => {
  if (!process.env.TEST_SKIP_MSSQL && !process.env.TEST_MSSQL_URI) {
    throw new Error('You must set a value for process.env.TEST_MSSQL_URI. See TESTING.md')
  }
  if (!process.env.TEST_SKIP_MSSQL && !process.env.TEST_MSSQL_JDBC_URI_MIGRATE) {
    throw new Error('You must set a value for process.env.TEST_MSSQL_JDBC_URI_MIGRATE. See TESTING.md')
  }

  const databaseName = 'tests-migrate-db-pull'
  const setupParams: SetupParams = {
    connectionString: process.env.TEST_MSSQL_URI!,
    // Note: at this location there is a setup.sql file
    // which will be executed a SQL file so the database is not empty
    dirname: path.join(__dirname, '..', '__tests__', 'fixtures', 'introspection', 'sqlserver'),
  }

  beforeAll(async () => {
    await tearDownMSSQL(setupParams, databaseName).catch((e) => {
      console.error(e)
    })
  })

  beforeEach(async () => {
    await setupMSSQL(setupParams, databaseName).catch((e) => {
      console.error(e)
    })
    // Back to original env vars
    process.env = { ...originalEnv }
    // Update env var because it's the one that is used in the schemas tested
    process.env.TEST_MSSQL_JDBC_URI_MIGRATE = process.env.TEST_MSSQL_JDBC_URI_MIGRATE?.replace(
      'tests-migrate',
      databaseName,
    )
    process.env.TEST_MSSQL_SHADOWDB_JDBC_URI_MIGRATE = process.env.TEST_MSSQL_SHADOWDB_JDBC_URI_MIGRATE?.replace(
      'tests-migrate-shadowdb',
      `${databaseName}-shadowdb`,
    )
  })

  afterEach(async () => {
    // Back to original env vars
    process.env = { ...originalEnv }
    await tearDownMSSQL(setupParams, databaseName).catch((e) => {
      console.error(e)
    })
  })

  test('basic introspection', async () => {
    ctx.fixture('introspection/sqlserver')
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
    const result = introspect.parse(['--print', '--url', process.env.TEST_MSSQL_JDBC_URI_MIGRATE!])
    await expect(result).resolves.toMatchInlineSnapshot(``)
    expect(ctx.mocked['console.log'].mock.calls.join('\n')).toMatchSnapshot()
    expect(ctx.mocked['console.info'].mock.calls.join('\n')).toMatchInlineSnapshot(``)
    expect(ctx.mocked['console.error'].mock.calls.join('\n')).toMatchInlineSnapshot(``)
    expect(ctx.mocked['process.stdout.write'].mock.calls.join('\n')).toMatchInlineSnapshot(``)
    expect(ctx.mocked['process.stderr.write'].mock.calls.join('\n')).toMatchInlineSnapshot(``)
  })
})

describeIf(!process.env.TEST_SKIP_MONGODB)('MongoDB', () => {
  const MONGO_URI = process.env.TEST_MONGO_URI_MIGRATE!

  if (isMacOrWindowsCI) {
    jest.setTimeout(60_000)
  }

  test('basic introspection', async () => {
    ctx.fixture('schema-only-mongodb')
    const introspect = new DbPull()
    const result = introspect.parse(['--schema=./prisma/no-model.prisma'])
    await expect(result).resolves.toMatchInlineSnapshot(``)
    expect(ctx.mocked['console.log'].mock.calls.join('\n')).toMatchInlineSnapshot(``)
    expect(ctx.mocked['console.info'].mock.calls.join('\n')).toMatchInlineSnapshot(`
      Prisma schema loaded from prisma/no-model.prisma
      Datasource "my_db": MongoDB database "tests-migrate" at "localhost:27017"
    `)
    expect(ctx.mocked['console.error'].mock.calls.join('\n')).toMatchInlineSnapshot(``)
    expect(ctx.mocked['process.stdout.write'].mock.calls.join('\n')).toMatchInlineSnapshot(`


      - Introspecting based on datasource defined in prisma/no-model.prisma

      ✔ Introspected 1 model and 2 embedded documents and wrote them into prisma/no-model.prisma in XXXms
            
      *** WARNING ***

      The following fields had data stored in multiple types. Either use Json or normalize data to the wanted type:
        - model: users, field: numberOrString1, type: Json

      The following fields had data stored in multiple types. Either use Json or normalize data to the wanted type:
        - composite type: UsersHobbies, field: numberOrString2, type: Json
        - composite type: UsersHobbiesObjects, field: numberOrString3, type: Json

      Run prisma generate to generate Prisma Client.

    `)
    expect(ctx.mocked['process.stderr.write'].mock.calls.join('\n')).toMatchInlineSnapshot(``)
  })

  test('introspection --force (existing models)', async () => {
    ctx.fixture('schema-only-mongodb')
    const introspect = new DbPull()
    const result = introspect.parse(['--force'])
    await expect(result).resolves.toMatchInlineSnapshot(``)
    expect(ctx.mocked['console.log'].mock.calls.join('\n')).toMatchInlineSnapshot(``)
    expect(ctx.mocked['console.info'].mock.calls.join('\n')).toMatchInlineSnapshot(`
      Prisma schema loaded from prisma/schema.prisma
      Datasource "my_db": MongoDB database "tests-migrate" at "localhost:27017"
    `)
    expect(ctx.mocked['console.error'].mock.calls.join('\n')).toMatchInlineSnapshot(``)
    expect(ctx.mocked['process.stdout.write'].mock.calls.join('\n')).toMatchInlineSnapshot(`


      - Introspecting based on datasource defined in prisma/schema.prisma

      ✔ Introspected 1 model and 2 embedded documents and wrote them into prisma/schema.prisma in XXXms
            
      *** WARNING ***

      The following fields had data stored in multiple types. Either use Json or normalize data to the wanted type:
        - model: users, field: numberOrString1, type: Json

      The following fields had data stored in multiple types. Either use Json or normalize data to the wanted type:
        - composite type: UsersHobbies, field: numberOrString2, type: Json
        - composite type: UsersHobbiesObjects, field: numberOrString3, type: Json

      Run prisma generate to generate Prisma Client.

    `)
    expect(ctx.mocked['process.stderr.write'].mock.calls.join('\n')).toMatchInlineSnapshot(``)
  })

  test('introspection --print (no existing models)', async () => {
    ctx.fixture('schema-only-mongodb')
    const introspect = new DbPull()
    const result = introspect.parse(['--schema=./prisma/no-model.prisma', '--print'])
    await expect(result).resolves.toMatchInlineSnapshot(``)
    expect(ctx.mocked['console.log'].mock.calls.join('\n')).toMatchInlineSnapshot(`
      generator client {
        provider = "prisma-client-js"
      }

      datasource my_db {
        provider = "mongodb"
        url      = env("TEST_MONGO_URI_MIGRATE")
      }

      type UsersHobbies {
        name            String
        /// Multiple data types found: String: 50%, Int: 50% out of 2 sampled entries
        numberOrString2 Json?
        objects         UsersHobbiesObjects[]
        tags            String[]
      }

      type UsersHobbiesObjects {
        name            String
        /// Multiple data types found: String: 50%, Int: 50% out of 2 sampled entries
        numberOrString3 Json
        tags            String[]
      }

      model users {
        id              String         @id @default(auto()) @map("_id") @my_db.ObjectId
        admin           Boolean
        email           String
        hobbies         UsersHobbies[]
        name            String
        /// Multiple data types found: String: 50%, Int: 50% out of 2 sampled entries
        numberOrString1 Json
      }


      // introspectionSchemaVersion: NonPrisma,
    `)
    expect(ctx.mocked['console.info'].mock.calls.join('\n')).toMatchInlineSnapshot(``)
    expect(ctx.mocked['console.error'].mock.calls.join('\n')).toMatchInlineSnapshot(`

      // *** WARNING ***
      // 
      // The following fields had data stored in multiple types. Either use Json or normalize data to the wanted type:
      //   - model: users, field: numberOrString1, type: Json
      // 
      // The following fields had data stored in multiple types. Either use Json or normalize data to the wanted type:
      //   - composite type: UsersHobbies, field: numberOrString2, type: Json
      //   - composite type: UsersHobbiesObjects, field: numberOrString3, type: Json
      // 
    `)
    expect(ctx.mocked['process.stdout.write'].mock.calls.join('\n')).toMatchInlineSnapshot(``)
    expect(ctx.mocked['process.stderr.write'].mock.calls.join('\n')).toMatchInlineSnapshot(``)
  })

  test('introspection --print --composite-type-depth=0 (no existing models)', async () => {
    ctx.fixture('schema-only-mongodb')
    const introspect = new DbPull()
    const result = introspect.parse(['--schema=./prisma/no-model.prisma', '--print', '--composite-type-depth=0'])
    await expect(result).resolves.toMatchInlineSnapshot(``)
    expect(ctx.mocked['console.log'].mock.calls.join('\n')).toMatchInlineSnapshot(`
      generator client {
        provider = "prisma-client-js"
      }

      datasource my_db {
        provider = "mongodb"
        url      = env("TEST_MONGO_URI_MIGRATE")
      }

      model users {
        id              String  @id @default(auto()) @map("_id") @my_db.ObjectId
        admin           Boolean
        email           String
        hobbies         Json[]
        name            String
        /// Multiple data types found: String: 50%, Int: 50% out of 2 sampled entries
        numberOrString1 Json
      }


      // introspectionSchemaVersion: NonPrisma,
    `)
    expect(ctx.mocked['console.info'].mock.calls.join('\n')).toMatchInlineSnapshot(``)
    expect(ctx.mocked['console.error'].mock.calls.join('\n')).toMatchInlineSnapshot(`

      // *** WARNING ***
      // 
      // The following fields had data stored in multiple types. Either use Json or normalize data to the wanted type:
      //   - model: users, field: numberOrString1, type: Json
      // 
    `)
    expect(ctx.mocked['process.stdout.write'].mock.calls.join('\n')).toMatchInlineSnapshot(``)
    expect(ctx.mocked['process.stderr.write'].mock.calls.join('\n')).toMatchInlineSnapshot(``)
  })

  test('introspection --print --composite-type-depth=1 (no existing models)', async () => {
    ctx.fixture('schema-only-mongodb')
    const introspect = new DbPull()
    const result = introspect.parse(['--schema=./prisma/no-model.prisma', '--print', '--composite-type-depth=1'])
    await expect(result).resolves.toMatchInlineSnapshot(``)
    expect(ctx.mocked['console.log'].mock.calls.join('\n')).toMatchInlineSnapshot(`
      generator client {
        provider = "prisma-client-js"
      }

      datasource my_db {
        provider = "mongodb"
        url      = env("TEST_MONGO_URI_MIGRATE")
      }

      type UsersHobbies {
        name            String
        /// Multiple data types found: String: 50%, Int: 50% out of 2 sampled entries
        numberOrString2 Json?
        objects         Json[]
        tags            String[]
      }

      model users {
        id              String         @id @default(auto()) @map("_id") @my_db.ObjectId
        admin           Boolean
        email           String
        hobbies         UsersHobbies[]
        name            String
        /// Multiple data types found: String: 50%, Int: 50% out of 2 sampled entries
        numberOrString1 Json
      }


      // introspectionSchemaVersion: NonPrisma,
    `)
    expect(ctx.mocked['console.info'].mock.calls.join('\n')).toMatchInlineSnapshot(``)
    expect(ctx.mocked['console.error'].mock.calls.join('\n')).toMatchInlineSnapshot(`

      // *** WARNING ***
      // 
      // The following fields had data stored in multiple types. Either use Json or normalize data to the wanted type:
      //   - model: users, field: numberOrString1, type: Json
      // 
      // The following fields had data stored in multiple types. Either use Json or normalize data to the wanted type:
      //   - composite type: UsersHobbies, field: numberOrString2, type: Json
      // 
    `)
    expect(ctx.mocked['process.stdout.write'].mock.calls.join('\n')).toMatchInlineSnapshot(``)
    expect(ctx.mocked['process.stderr.write'].mock.calls.join('\n')).toMatchInlineSnapshot(``)
  })

  test('introspection --force --composite-type-depth=-1 (existing models)', async () => {
    ctx.fixture('schema-only-mongodb')
    const introspect = new DbPull()
    const result = introspect.parse(['--force', '--composite-type-depth=-1'])
    await expect(result).resolves.toMatchInlineSnapshot(``)
    expect(ctx.mocked['console.log'].mock.calls.join('\n')).toMatchInlineSnapshot(``)
    expect(ctx.mocked['console.info'].mock.calls.join('\n')).toMatchInlineSnapshot(`
      Prisma schema loaded from prisma/schema.prisma
      Datasource "my_db": MongoDB database "tests-migrate" at "localhost:27017"
    `)
    expect(ctx.mocked['console.error'].mock.calls.join('\n')).toMatchInlineSnapshot(``)
    expect(ctx.mocked['process.stdout.write'].mock.calls.join('\n')).toMatchInlineSnapshot(`


      - Introspecting based on datasource defined in prisma/schema.prisma

      ✔ Introspected 1 model and 2 embedded documents and wrote them into prisma/schema.prisma in XXXms
            
      *** WARNING ***

      The following fields had data stored in multiple types. Either use Json or normalize data to the wanted type:
        - model: users, field: numberOrString1, type: Json

      The following fields had data stored in multiple types. Either use Json or normalize data to the wanted type:
        - composite type: UsersHobbies, field: numberOrString2, type: Json
        - composite type: UsersHobbiesObjects, field: numberOrString3, type: Json

      Run prisma generate to generate Prisma Client.

    `)
    expect(ctx.mocked['process.stderr.write'].mock.calls.join('\n')).toMatchInlineSnapshot(``)
  })

  test('introspection --print --composite-type-depth=-1 (no existing models)', async () => {
    ctx.fixture('schema-only-mongodb')
    const introspect = new DbPull()
    const result = introspect.parse(['--schema=./prisma/no-model.prisma', '--print', '--composite-type-depth=-1'])
    await expect(result).resolves.toMatchInlineSnapshot(``)
    expect(ctx.mocked['console.log'].mock.calls.join('\n')).toMatchInlineSnapshot(`
      generator client {
        provider = "prisma-client-js"
      }

      datasource my_db {
        provider = "mongodb"
        url      = env("TEST_MONGO_URI_MIGRATE")
      }

      type UsersHobbies {
        name            String
        /// Multiple data types found: String: 50%, Int: 50% out of 2 sampled entries
        numberOrString2 Json?
        objects         UsersHobbiesObjects[]
        tags            String[]
      }

      type UsersHobbiesObjects {
        name            String
        /// Multiple data types found: String: 50%, Int: 50% out of 2 sampled entries
        numberOrString3 Json
        tags            String[]
      }

      model users {
        id              String         @id @default(auto()) @map("_id") @my_db.ObjectId
        admin           Boolean
        email           String
        hobbies         UsersHobbies[]
        name            String
        /// Multiple data types found: String: 50%, Int: 50% out of 2 sampled entries
        numberOrString1 Json
      }


      // introspectionSchemaVersion: NonPrisma,
    `)
    expect(ctx.mocked['console.info'].mock.calls.join('\n')).toMatchInlineSnapshot(``)
    expect(ctx.mocked['console.error'].mock.calls.join('\n')).toMatchInlineSnapshot(`

      // *** WARNING ***
      // 
      // The following fields had data stored in multiple types. Either use Json or normalize data to the wanted type:
      //   - model: users, field: numberOrString1, type: Json
      // 
      // The following fields had data stored in multiple types. Either use Json or normalize data to the wanted type:
      //   - composite type: UsersHobbies, field: numberOrString2, type: Json
      //   - composite type: UsersHobbiesObjects, field: numberOrString3, type: Json
      // 
    `)
    expect(ctx.mocked['process.stdout.write'].mock.calls.join('\n')).toMatchInlineSnapshot(``)
    expect(ctx.mocked['process.stderr.write'].mock.calls.join('\n')).toMatchInlineSnapshot(``)
  })

  test('basic introspection --url', async () => {
    const introspect = new DbPull()
    const result = introspect.parse(['--print', '--url', MONGO_URI])
    await expect(result).resolves.toMatchInlineSnapshot(``)
    expect(ctx.mocked['console.log'].mock.calls.join('\n')).toMatchSnapshot()
    expect(ctx.mocked['console.info'].mock.calls.join('\n')).toMatchInlineSnapshot(``)
    expect(ctx.mocked['console.error'].mock.calls.join('\n')).toMatchInlineSnapshot(`

      // *** WARNING ***
      // 
      // The following fields had data stored in multiple types. Either use Json or normalize data to the wanted type:
      //   - model: users, field: numberOrString1, type: Json
      // 
      // The following fields had data stored in multiple types. Either use Json or normalize data to the wanted type:
      //   - composite type: UsersHobbies, field: numberOrString2, type: Json
      //   - composite type: UsersHobbiesObjects, field: numberOrString3, type: Json
      // 
    `)
    expect(ctx.mocked['process.stdout.write'].mock.calls.join('\n')).toMatchInlineSnapshot(``)
    expect(ctx.mocked['process.stderr.write'].mock.calls.join('\n')).toMatchInlineSnapshot(``)
  })

  // In this case it should not error and the line `Datasource "x"` not be printed
  test('introspection --url - only generator defined', async () => {
    ctx.fixture('schema-only-mongodb/only-generator')
    const introspect = new DbPull()
    const result = introspect.parse(['--url', MONGO_URI])
    await expect(result).resolves.toMatchInlineSnapshot(``)
    expect(ctx.mocked['console.log'].mock.calls.join('\n')).toMatchInlineSnapshot(``)
    expect(ctx.mocked['console.info'].mock.calls.join('\n')).not.toContain(`Datasource `)
    expect(ctx.mocked['console.info'].mock.calls.join('\n')).toMatchInlineSnapshot(
      `Prisma schema loaded from schema.prisma`,
    )
    expect(ctx.mocked['console.error'].mock.calls.join('\n')).toMatchInlineSnapshot(``)
    expect(ctx.mocked['process.stdout.write'].mock.calls.join('\n')).toMatchInlineSnapshot(`


      - Introspecting

      ✔ Introspected 1 model and 2 embedded documents and wrote them into schema.prisma in XXXms
            
      *** WARNING ***

      The following fields had data stored in multiple types. Either use Json or normalize data to the wanted type:
        - model: users, field: numberOrString1, type: Json

      The following fields had data stored in multiple types. Either use Json or normalize data to the wanted type:
        - composite type: UsersHobbies, field: numberOrString2, type: Json
        - composite type: UsersHobbiesObjects, field: numberOrString3, type: Json

      Run prisma generate to generate Prisma Client.

    `)
    expect(ctx.mocked['process.stderr.write'].mock.calls.join('\n')).toMatchInlineSnapshot(``)
  })

  test('introspection with --force', async () => {
    ctx.fixture('schema-only-mongodb')
    const introspect = new DbPull()
    const result = introspect.parse(['--force'])
    await expect(result).resolves.toMatchInlineSnapshot(``)
    expect(ctx.mocked['console.log'].mock.calls.join('\n')).toMatchInlineSnapshot(``)
    expect(ctx.mocked['console.info'].mock.calls.join('\n')).toMatchInlineSnapshot(`
      Prisma schema loaded from prisma/schema.prisma
      Datasource "my_db": MongoDB database "tests-migrate" at "localhost:27017"
    `)
    expect(ctx.mocked['console.error'].mock.calls.join('\n')).toMatchInlineSnapshot(``)
    expect(ctx.mocked['process.stdout.write'].mock.calls.join('\n')).toMatchInlineSnapshot(`


      - Introspecting based on datasource defined in prisma/schema.prisma

      ✔ Introspected 1 model and 2 embedded documents and wrote them into prisma/schema.prisma in XXXms
            
      *** WARNING ***

      The following fields had data stored in multiple types. Either use Json or normalize data to the wanted type:
        - model: users, field: numberOrString1, type: Json

      The following fields had data stored in multiple types. Either use Json or normalize data to the wanted type:
        - composite type: UsersHobbies, field: numberOrString2, type: Json
        - composite type: UsersHobbiesObjects, field: numberOrString3, type: Json

      Run prisma generate to generate Prisma Client.

    `)
    expect(ctx.mocked['process.stderr.write'].mock.calls.join('\n')).toMatchInlineSnapshot(``)
  })

  test('re-introspection should error (not supported) (existing models)', async () => {
    ctx.fixture('schema-only-mongodb')
    const introspect = new DbPull()
    const result = introspect.parse([])
    await expect(result).rejects.toThrowErrorMatchingInlineSnapshot(`
            Iterating on one schema using re-introspection with db pull is currently not supported with MongoDB provider.
            You can explicitly ignore and override your current local schema file with prisma db pull --force
            Some information will be lost (relations, comments, mapped fields, @ignore...), follow https://github.com/prisma/prisma/issues/9585 for more info.
          `)
    expect(ctx.mocked['console.log'].mock.calls.join('\n')).toMatchInlineSnapshot(``)
    expect(ctx.mocked['console.info'].mock.calls.join('\n')).toMatchInlineSnapshot(`
      Prisma schema loaded from prisma/schema.prisma
      Datasource "my_db": MongoDB database "tests-migrate" at "localhost:27017"
    `)
    expect(ctx.mocked['console.error'].mock.calls.join('\n')).toMatchInlineSnapshot(``)
    expect(ctx.mocked['process.stdout.write'].mock.calls.join('\n')).toMatchInlineSnapshot(``)
    expect(ctx.mocked['process.stderr.write'].mock.calls.join('\n')).toMatchInlineSnapshot(``)
  })
})

describeIf(!process.env.TEST_SKIP_MSSQL)('sqlserver-multi-schema', () => {
  if (process.env.CI) {
    // to avoid timeouts on macOS
    jest.setTimeout(80_000)
  } else {
    jest.setTimeout(20_000)
  }

  if (!process.env.TEST_SKIP_MSSQL && !process.env.TEST_MSSQL_URI) {
    throw new Error('You must set a value for process.env.TEST_MSSQL_URI. See TESTING.md')
  }

  // Note that this needs to be exactly the same as the one in the setup.sql file
  const databaseName = 'tests-migrate-db-pull-multi-schema'
  const setupParams: SetupParams = {
    connectionString: process.env.TEST_MSSQL_URI!,
    // Note: at this location there is a setup.sql file
    // which will be executed a SQL file so the database is not empty
    dirname: path.join(__dirname, '..', '__tests__', 'fixtures', 'introspection', 'sqlserver-multi-schema'),
  }

  beforeAll(async () => {
    await tearDownMSSQL(setupParams, databaseName).catch((e) => {
      console.error(e)
    })
  })

  beforeEach(async () => {
    await setupMSSQL(setupParams, databaseName).catch((e) => {
      console.error(e)
    })
    // Back to original env vars
    process.env = { ...originalEnv }
    // Update env var because it's the one that is used in the schemas tested
    process.env.TEST_MSSQL_JDBC_URI_MIGRATE = process.env.TEST_MSSQL_JDBC_URI_MIGRATE?.replace(
      'tests-migrate',
      databaseName,
    )
  })

  afterEach(async () => {
    // Back to original env vars
    process.env = { ...originalEnv }
    await tearDownMSSQL(setupParams, databaseName).catch((e) => {
      console.error(e)
    })
  })

  test('without datasource property `schemas` it should error with P4001, empty database', async () => {
    ctx.fixture('introspection/sqlserver-multi-schema')
    const introspect = new DbPull()
    const result = introspect.parse(['--print', '--schema', 'without-schemas-in-datasource.prisma'])
    await expect(result).rejects.toThrow(`P4001`)
    expect(ctx.mocked['console.log'].mock.calls.join('\n')).toMatchInlineSnapshot(``)
    expect(ctx.mocked['console.info'].mock.calls.join('\n')).toMatchInlineSnapshot(``)
    expect(ctx.mocked['console.error'].mock.calls.join('\n')).toMatchInlineSnapshot(``)
    expect(ctx.mocked['process.stdout.write'].mock.calls.join('\n')).toMatchInlineSnapshot(``)
    expect(ctx.mocked['process.stderr.write'].mock.calls.join('\n')).toMatchInlineSnapshot(``)
  })

  test('datasource property `schemas=[]` should error with P1012, array can not be empty', async () => {
    ctx.fixture('introspection/sqlserver-multi-schema')
    const introspect = new DbPull()
    const result = introspect.parse(['--print', '--schema', 'with-schemas-in-datasource-0-value.prisma'])
    await expect(result).rejects.toMatchInlineSnapshot(`
      Prisma schema validation - (get-config wasm)
      Error code: P1012
      error: If provided, the schemas array can not be empty.
        -->  schema.prisma:4
         | 
       3 |   url      = env("TEST_MSSQL_JDBC_URI_MIGRATE")
       4 |   schemas  = []
         | 

      Validation Error Count: 1
      [Context: getConfig]

      Prisma CLI Version : 0.0.0
    `)
    expect(ctx.mocked['console.log'].mock.calls.join('\n')).toMatchInlineSnapshot(``)
    expect(ctx.mocked['console.info'].mock.calls.join('\n')).toMatchInlineSnapshot(``)
    expect(ctx.mocked['console.error'].mock.calls.join('\n')).toMatchInlineSnapshot(``)
    expect(ctx.mocked['process.stdout.write'].mock.calls.join('\n')).toMatchInlineSnapshot(``)
    expect(ctx.mocked['process.stderr.write'].mock.calls.join('\n')).toMatchInlineSnapshot(``)
  })

  // TODO unskip in a following PR
  // We need to find out why this test can fail and pass in CI...
  // It was blocking the release pipeline
  // Examples
  // https://github.com/prisma/prisma/actions/runs/4013789656/jobs/6893546711 (most recent)
  // https://buildkite.com/prisma/test-prisma-typescript/builds/18825#01855966-3d90-4362-b130-502021a1047b
  test.skip('datasource property `schemas=["base", "transactional"]` should succeed', async () => {
    ctx.fixture('introspection/sqlserver-multi-schema')
    const introspect = new DbPull()
    const result = introspect.parse(['--print', '--schema', 'with-schemas-in-datasource-2-values.prisma'])
    await expect(result).resolves.toMatchInlineSnapshot(``)
    expect(sanitizeSQLServerIdName(ctx.mocked['console.log'].mock.calls.join('\n'))).toMatchSnapshot()
    expect(ctx.mocked['console.info'].mock.calls.join('\n')).toMatchInlineSnapshot(``)
    expect(ctx.mocked['console.error'].mock.calls.join('\n')).toMatchInlineSnapshot(`

      // *** WARNING ***
      // 
      // The following models were ignored as they do not have a valid unique identifier or id. This is currently not supported by the Prisma Client:
      //   - transactional_some_table
      // 
      // These items were renamed due to their names being duplicates in the Prisma Schema Language:
      //   - type: model, name: base_some_table
      //   - type: model, name: transactional_some_table
      // 
    `)
    expect(ctx.mocked['process.stdout.write'].mock.calls.join('\n')).toMatchInlineSnapshot(``)
    expect(ctx.mocked['process.stderr.write'].mock.calls.join('\n')).toMatchInlineSnapshot(``)
  })

  test('datasource property `schemas=["base"]` should succeed', async () => {
    ctx.fixture('introspection/sqlserver-multi-schema')
    const introspect = new DbPull()
    const result = introspect.parse(['--print', '--schema', 'with-schemas-in-datasource-1-value.prisma'])
    await expect(result).resolves.toMatchInlineSnapshot(``)
    expect(sanitizeSQLServerIdName(ctx.mocked['console.log'].mock.calls.join('\n'))).toMatchSnapshot()
    expect(ctx.mocked['console.info'].mock.calls.join('\n')).toMatchInlineSnapshot(``)
    expect(ctx.mocked['console.error'].mock.calls.join('\n')).toMatchInlineSnapshot(``)
    expect(ctx.mocked['process.stdout.write'].mock.calls.join('\n')).toMatchInlineSnapshot(``)
    expect(ctx.mocked['process.stderr.write'].mock.calls.join('\n')).toMatchInlineSnapshot(``)
  })

  test('datasource property `schemas=["does-not-exist"]` should error with P4001, empty database', async () => {
    ctx.fixture('introspection/sqlserver-multi-schema')
    const introspect = new DbPull()
    const result = introspect.parse(['--print', '--schema', 'with-schemas-in-datasource-1-non-existing-value.prisma'])
    await expect(result).rejects.toThrow(`P4001`)
    expect(ctx.mocked['console.log'].mock.calls.join('\n')).toMatchSnapshot()
    expect(ctx.mocked['console.info'].mock.calls.join('\n')).toMatchInlineSnapshot(``)
    expect(ctx.mocked['console.error'].mock.calls.join('\n')).toMatchInlineSnapshot(``)
    expect(ctx.mocked['process.stdout.write'].mock.calls.join('\n')).toMatchInlineSnapshot(``)
    expect(ctx.mocked['process.stderr.write'].mock.calls.join('\n')).toMatchInlineSnapshot(``)
  })

  test('datasource property `schemas=["does-not-exist", "base"]` should succeed', async () => {
    ctx.fixture('introspection/sqlserver-multi-schema')
    const introspect = new DbPull()
    const result = introspect.parse([
      '--print',
      '--schema',
      'with-schemas-in-datasource-1-existing-1-non-existing-value.prisma',
    ])
    await expect(result).resolves.toMatchInlineSnapshot(``)
    expect(sanitizeSQLServerIdName(ctx.mocked['console.log'].mock.calls.join('\n'))).toMatchSnapshot()
    expect(ctx.mocked['console.info'].mock.calls.join('\n')).toMatchInlineSnapshot(``)
    expect(ctx.mocked['console.error'].mock.calls.join('\n')).toMatchInlineSnapshot(``)
    expect(ctx.mocked['process.stdout.write'].mock.calls.join('\n')).toMatchInlineSnapshot(``)
    expect(ctx.mocked['process.stderr.write'].mock.calls.join('\n')).toMatchInlineSnapshot(``)
  })

  test('--url with `?schema=does-not-exist` should error with with P4001, empty database', async () => {
    const introspect = new DbPull()
    const connectionString = `${process.env.TEST_MSSQL_JDBC_URI_MIGRATE}schema=does-not-exist`
    const result = introspect.parse(['--print', '--url', connectionString])
    await expect(result).rejects.toThrow(`P4001`)
    expect(ctx.mocked['console.log'].mock.calls.join('\n')).toMatchSnapshot()
    expect(ctx.mocked['console.info'].mock.calls.join('\n')).toMatchInlineSnapshot(``)
    expect(ctx.mocked['console.error'].mock.calls.join('\n')).toMatchInlineSnapshot(``)
    expect(ctx.mocked['process.stdout.write'].mock.calls.join('\n')).toMatchInlineSnapshot(``)
    expect(ctx.mocked['process.stderr.write'].mock.calls.join('\n')).toMatchInlineSnapshot(``)
  })

  test('--url with `?schema=base` should succeed', async () => {
    const introspect = new DbPull()
    const connectionString = `${process.env.TEST_MSSQL_JDBC_URI_MIGRATE}schema=base`
    const result = introspect.parse(['--print', '--url', connectionString])
    await expect(result).resolves.toMatchInlineSnapshot(``)
    expect(sanitizeSQLServerIdName(ctx.mocked['console.log'].mock.calls.join('\n'))).toMatchSnapshot()
    expect(ctx.mocked['console.info'].mock.calls.join('\n')).toMatchInlineSnapshot(``)
    expect(ctx.mocked['console.error'].mock.calls.join('\n')).toMatchInlineSnapshot(``)
    expect(ctx.mocked['process.stdout.write'].mock.calls.join('\n')).toMatchInlineSnapshot(``)
    expect(ctx.mocked['process.stderr.write'].mock.calls.join('\n')).toMatchInlineSnapshot(``)
  })
})
