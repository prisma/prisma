import path from 'path'

import { DbPull } from '../../commands/DbPull'
import { SetupParams, setupPostgres, tearDownPostgres } from '../../utils/setupPostgres'
import { describeMatrix, postgresOnly } from '../__helpers__/conditionalTests'
import { createDefaultTestContext } from '../__helpers__/context'

const isMacOrWindowsCI = Boolean(process.env.CI) && ['darwin', 'win32'].includes(process.platform)
if (isMacOrWindowsCI) {
  jest.setTimeout(60_000)
}

const ctx = createDefaultTestContext()

describeMatrix(postgresOnly, 'postgresql', () => {
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
    // Update env var because it's the one that is used in the schemas tested
    process.env.TEST_POSTGRES_URI_MIGRATE = connectionString
  })

  afterEach(async () => {
    await tearDownPostgres(setupParams).catch((e) => {
      console.error(e)
    })
  })

  test('basic introspection', async () => {
    ctx.fixture('introspection/postgresql')
    const introspect = new DbPull()
    const result = introspect.parse(['--print'], await ctx.config())
    await expect(result).resolves.toMatchInlineSnapshot(`""`)

    expect(ctx.normalizedCapturedStdout()).toMatchInlineSnapshot(`
      "datasource db {
        provider = "postgres"
        url      = env("TEST_POSTGRES_URI_MIGRATE")
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

      "
    `)
    expect(ctx.normalizedCapturedStderr()).toMatchInlineSnapshot(`""`)
  })

  describe('empty or incomplete schema', () => {
    beforeEach(() => {
      ctx.setDatasource({
        url: setupParams.connectionString,
      })
    })

    afterEach(() => {
      ctx.resetDatasource()
    })

    test('basic introspection config + empty schema', async () => {
      ctx.fixture('empty-schema')
      const introspect = new DbPull()
      const result = introspect.parse(['--print'], await ctx.config())
      await expect(result).rejects.toMatchInlineSnapshot(`
        "There is no datasource in the schema.

        "
      `)

      expect(ctx.normalizedCapturedStdout()).toMatchInlineSnapshot(`
        "
        "
      `)
      expect(ctx.normalizedCapturedStderr()).toMatchInlineSnapshot(`""`)
    })

    test('basic introspection config + schema with no linebreak after generator block', async () => {
      ctx.fixture('generator-only')
      const introspect = new DbPull()
      const result = introspect.parse(['--print'], await ctx.config())
      await expect(result).rejects.toMatchInlineSnapshot(`
        "There is no datasource in the schema.

        "
      `)

      expect(ctx.normalizedCapturedStdout()).toMatchInlineSnapshot(`
        "
        "
      `)
      expect(ctx.normalizedCapturedStderr()).toMatchInlineSnapshot(`""`)
    })

    test('introspection with postgresql provider but schema has a sqlite provider should fail', async () => {
      ctx.fixture('schema-only-sqlite')

      // TODO: this error is not entirely correct: the invalid URL is in the config file,
      // not in the datasource block. The message needs to be updated when removing the
      // `url` property from the PSL.
      await expect(DbPull.new().parse(['--print'], await ctx.config())).rejects.toMatchInlineSnapshot(`
        "P1012

        error: Error validating datasource \`my_db\`: the URL must start with the protocol \`file:\`.
          -->  prisma/schema.prisma:3
           | 
         2 |   provider = "sqlite"
         3 |   url      = "file:../dev.db"
           | 


        Introspection failed as your current Prisma schema file is invalid

        Please fix your current schema manually (using either prisma validate or the Prisma VS Code extension to understand what's broken and confirm you fixed it), and then run this command again.
        Or run this command with the --force flag to ignore your current schema and overwrite it. All local modifications will be lost.
        "
      `)

      expect(ctx.normalizedCapturedStderr()).toMatchInlineSnapshot(`""`)
      expect(ctx.normalizedCapturedStdout()).toMatchInlineSnapshot(`
        "
        "
      `)
      expect(ctx.mocked['console.error'].mock.calls.join('\n')).toMatchInlineSnapshot(`""`)
    })
  })

  test('introspection should load .env file with --print', async () => {
    ctx.fixture('schema-only-postgresql')
    expect.assertions(3)

    try {
      await DbPull.new().parse(['--print', '--schema=./prisma/using-dotenv.prisma'], await ctx.config())
    } catch (e) {
      expect(e.code).toEqual('P1001')
      expect(e.message).toContain(`fromdotenvdoesnotexist`)
    }

    expect(ctx.mocked['console.error'].mock.calls.join('\n')).toMatchInlineSnapshot(`""`)
  })

  test('introspection should load .env file without --print', async () => {
    ctx.fixture('schema-only-postgresql')
    expect.assertions(5)

    try {
      await DbPull.new().parse(['--schema=./prisma/using-dotenv.prisma'], await ctx.config())
    } catch (e) {
      expect(e.code).toEqual('P1001')
      expect(e.message).toContain(`fromdotenvdoesnotexist`)
    }

    expect(ctx.normalizedCapturedStderr()).toMatchInlineSnapshot(`
      "Environment variables loaded from prisma/.env
      "
    `)
    expect(ctx.normalizedCapturedStdout()).toMatchInlineSnapshot(`
      "Prisma schema loaded from prisma/using-dotenv.prisma
      Datasource "my_db": PostgreSQL database "mydb", schema "public" <location placeholder>

      - Introspecting based on datasource defined in prisma/using-dotenv.prisma
      ✖ Introspecting based on datasource defined in prisma/using-dotenv.prisma

      "
    `)
    expect(ctx.mocked['console.error'].mock.calls.join('\n')).toMatchInlineSnapshot(`""`)
  })

  test('introspection works with directUrl from env var', async () => {
    ctx.fixture('schema-only-data-proxy')
    const result = DbPull.new().parse(['--schema', 'with-directUrl-env.prisma'], await ctx.config())

    await expect(result).resolves.toMatchInlineSnapshot(`""`)
    expect(ctx.normalizedCapturedStderr()).toMatchInlineSnapshot(`
      "Environment variables loaded from .env
      "
    `)
    expect(ctx.normalizedCapturedStdout()).toMatchInlineSnapshot(`
      "Prisma schema loaded from with-directUrl-env.prisma
      Datasource "db": PostgreSQL database "tests-migrate-db-pull-postgresql", schema "public" <location placeholder>

      - Introspecting based on datasource defined in with-directUrl-env.prisma
      ✔ Introspected 2 models and wrote them into with-directUrl-env.prisma in XXXms
            
      Run prisma generate to generate Prisma Client.
      "
    `)
    expect(ctx.mocked['console.error'].mock.calls.join('\n')).toMatchInlineSnapshot(`""`)
  })
})
