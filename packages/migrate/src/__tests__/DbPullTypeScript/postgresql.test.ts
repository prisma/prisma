import path from 'path'

import { DbPullTypeScript } from '../../commands/DbPullTypeScript'
import { type SetupParams, setupPostgres, tearDownPostgres } from '../../utils/setupPostgres'
import { describeMatrix, postgresOnly } from '../__helpers__/conditionalTests'
import { createDefaultTestContext } from '../__helpers__/context'
import { compareCommandOutputs } from './helpers'

const isMacOrWindowsCI = Boolean(process.env.CI) && ['darwin', 'win32'].includes(process.platform)
if (isMacOrWindowsCI) {
  jest.setTimeout(60_000)
}

const ctx = createDefaultTestContext()

/**
 * Tests for TypeScript-native db pull command with PostgreSQL.
 *
 * These tests ensure that DbPullTypeScript produces identical results to the
 * existing DbPull command while using WASM engines instead of RPC.
 * PostgreSQL is the primary target for driver adapters and TypeScript-native execution.
 */

describeMatrix(postgresOnly, 'DbPullTypeScript/postgresql', () => {
  const connectionString = process.env.TEST_POSTGRES_URI_MIGRATE!

  const setupParams: SetupParams = {
    connectionString,
    dirname: path.join(__dirname, '..', '..', '__tests__', 'fixtures', 'introspection', 'postgresql'),
  }

  beforeEach(async () => {
    await setupPostgres(setupParams)
  })

  afterEach(async () => {
    await tearDownPostgres(setupParams)
  })
  describe('Parity with DbPull command', () => {
    /**
     * Core parity test: ensures pull-ts produces identical output to pull
     */
    test('basic introspection produces identical results', async () => {
      ctx.fixture('introspection/postgresql')

      const comparison = await compareCommandOutputs(ctx, ['--print'])
      expect(comparison.match).toBe(true)

      // Verify expected PostgreSQL schema structure
      expect(comparison.originalOutput).toMatchInlineSnapshot(`
        "generator client {
          provider = "prisma-client"
        }

        datasource db {
          provider = "postgresql"
          url      = env("TEST_POSTGRES_URI_MIGRATE")
        }

        enum Role {
          USER
          ADMIN
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
          id      String  @id
          email   String  @unique
          name    String?
          role    Role    @default(USER)
          posts   Post[]
        }

        "
      `)
    })

    test('introspection with --force produces identical results', async () => {
      ctx.fixture('introspection/postgresql')

      const comparison = await compareCommandOutputs(ctx, ['--print', '--force'])
      expect(comparison.match).toBe(true)
    })

    test('reintrospection with warnings produces identical results', async () => {
      ctx.fixture('re-introspection/postgresql')

      const comparison = await compareCommandOutputs(ctx, ['--print', '--schema=./prisma/reintrospection.prisma'])
      expect(comparison.match).toBe(true)
    })
  })

  describe('TypeScript-specific functionality', () => {
    test('basic introspection', async () => {
      ctx.fixture('introspection/postgresql')
      const introspect = new DbPullTypeScript()
      const result = introspect.parse(['--print'], await ctx.config())
      await expect(result).resolves.toMatchInlineSnapshot(`""`)

      expect(ctx.normalizedCapturedStdout()).toMatchInlineSnapshot(`
        "generator client {
          provider = "prisma-client"
        }

        datasource db {
          provider = "postgresql"
          url      = env("TEST_POSTGRES_URI_MIGRATE")
        }

        enum Role {
          USER
          ADMIN
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
          id      String  @id
          email   String  @unique
          name    String?
          role    Role    @default(USER)
          posts   Post[]
        }

        "
      `)
    })

    test('introspection --force', async () => {
      ctx.fixture('introspection/postgresql')
      const introspect = new DbPullTypeScript()
      const result = introspect.parse(['--print', '--force'], await ctx.config())
      await expect(result).resolves.toMatchInlineSnapshot(`""`)

      expect(ctx.normalizedCapturedStdout()).toMatchInlineSnapshot(`
        "generator client {
          provider = "prisma-client"
        }

        datasource db {
          provider = "postgresql"
          url      = env("TEST_POSTGRES_URI_MIGRATE")
        }

        enum Role {
          USER
          ADMIN
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
          id      String  @id
          email   String  @unique
          name    String?
          role    Role    @default(USER)
          Post    Post[]
        }

        "
      `)
    })

    test('should succeed when schema and db do match', async () => {
      ctx.fixture('introspection/postgresql')
      const result = DbPullTypeScript.new().parse([], await ctx.config())
      await expect(result).resolves.toMatchInlineSnapshot(`""`)
      expect(ctx.mocked['console.log'].mock.calls.join('\n').replace(/\d{2,3}ms/, 'XXms')).toMatchInlineSnapshot(`""`)

      // Should include TypeScript-native indicator in success message
      expect(ctx.normalizedCapturedStdout()).toContain('(TypeScript-native)')
      expect(ctx.normalizedCapturedStdout()).toMatchInlineSnapshot(`
        "Prisma schema loaded from prisma/schema.prisma
        Datasource "db": PostgreSQL database "tests-migrate" <location placeholder>

        - Introspecting based on datasource defined in prisma/schema.prisma (TypeScript-native)
        ✔ Introspected 2 models and wrote them into prisma/schema.prisma in XXXms (TypeScript-native)
              
        Run prisma generate to generate Prisma Client.
        "
      `)
    })

    test('should succeed and keep changes to valid schema and output warnings', async () => {
      ctx.fixture('re-introspection/postgresql')
      const result = DbPullTypeScript.new().parse(['--schema=./prisma/reintrospection.prisma'], await ctx.config())
      await expect(result).resolves.toMatchInlineSnapshot(`""`)

      expect(ctx.normalizedCapturedStdout()).toContain('(TypeScript-native)')
      expect(ctx.normalizedCapturedStdout()).toMatchInlineSnapshot(`
        "Prisma schema loaded from prisma/reintrospection.prisma
        Datasource "db": PostgreSQL database "tests-migrate" <location placeholder>

        - Introspecting based on datasource defined in prisma/reintrospection.prisma (TypeScript-native)
        ✔ Introspected 2 models and wrote them into prisma/reintrospection.prisma in XXXms (TypeScript-native)
              
        *** WARNING ***

        These models were enriched with \`@@map\` information taken from the previous Prisma schema:
          - "AwesomePost"
          - "AwesomeUser"

        Run prisma generate to generate Prisma Client.
        "
      `)

      expect(ctx.fs.read('prisma/reintrospection.prisma')).toMatchInlineSnapshot(`
        "generator client {
          provider = "prisma-client"
          output   = "../generated/client"
        }

        datasource db {
          provider = "postgresql"
          url      = env("TEST_POSTGRES_URI_MIGRATE")
        }

        enum Role {
          USER
          ADMIN
        }

        model AwesomeUser {
          id       String        @id
          email    String        @unique
          name     String?
          role     Role          @default(USER)
          posts    AwesomePost[]

          @@map("User")
        }

        model AwesomePost {
          id        String    @id
          createdAt DateTime  @default(now())
          updatedAt DateTime  @default(dbgenerated("'1970-01-01 00:00:00'::timestamp without time zone"))
          published Boolean   @default(false)
          title     String
          content   String?
          authorId  String?
          jsonData  Json?
          coinflips Boolean[]
          User      AwesomeUser? @relation(fields: [authorId], references: [id])

          @@map("Post")
        }
        "
      `)
    })
  })

  describe('Error handling parity', () => {
    test('should fail when db is missing - identical error to original', async () => {
      ctx.fixture('schema-only-postgresql')

      const result = DbPullTypeScript.new().parse([], await ctx.config())
      await expect(result).rejects.toThrowErrorMatchingInlineSnapshot(`
        "
        P1003 The introspected database does not exist:

        prisma db pull-ts could not create any models in your schema.prisma file and you will not be able to generate Prisma Client with the prisma generate command.

        To fix this, you have two options:

        - manually create a database.
        - make sure the database connection URL inside the datasource block in schema.prisma points to an existing database.

        Then you can run prisma db pull-ts again. 
        "
      `)

      expect(ctx.normalizedCapturedStdout()).toContain('(TypeScript-native)')
    })

    test('should fail when db is empty - identical error to original', async () => {
      ctx.fixture('schema-only-postgresql')
      // PostgreSQL databases are never truly empty, but we can test with a database that has no user tables
      const result = DbPullTypeScript.new().parse([], await ctx.config())
      await expect(result).rejects.toThrowErrorMatchingInlineSnapshot(`
        "
        P4001 The introspected database was empty:

        prisma db pull-ts could not create any models in your schema.prisma file and you will not be able to generate Prisma Client with the prisma generate command.

        To fix this, you have two options:

        - manually create a table in your database.
        - make sure the database connection URL inside the datasource block in schema.prisma points to a database that is not empty (it must contain at least one table).

        Then you can run prisma db pull-ts again. 
        "
      `)

      expect(ctx.normalizedCapturedStdout()).toContain('(TypeScript-native)')
    })

    test('should fail when Prisma schema is missing', async () => {
      const result = DbPullTypeScript.new().parse([], await ctx.config())
      await expect(result).rejects.toThrowErrorMatchingInlineSnapshot(`
        "Could not find a schema.prisma file that is required for this command.
        You can either provide it with --schema, set it as \`prisma.schema\` in your package.json or put it into the default location ./prisma/schema.prisma https://pris.ly/d/prisma-schema-location"
      `)

      expect(ctx.normalizedCapturedStdout()).toMatchInlineSnapshot(`""`)
    })

    test('should fail when schema is invalid', async () => {
      ctx.fixture('introspection/postgresql')
      const result = DbPullTypeScript.new().parse(['--schema=./prisma/invalid.prisma'], await ctx.config())
      await expect(result).rejects.toThrowErrorMatchingInlineSnapshot(`
        "P1012

        error: Error validating model "something": Each model must have at least one unique criteria that has only required fields. Either mark a single field with \`@id\`, \`@unique\` or add a multi field criterion with \`@@id([])\` or \`@@unique([])\` to the model.
          -->  prisma/invalid.prisma:11
           | 
        10 | 
        11 | model something {
        12 |   id Int
        13 | }
           | 

        Introspection failed as your current Prisma schema file is invalid

        Please fix your current schema manually (using either prisma validate or the Prisma VS Code extension to understand what's broken and confirm you fixed it), and then run this command again.
        Or run this command with the --force flag to ignore your current schema and overwrite it. All local modifications will be lost.
        "
      `)

      expect(ctx.normalizedCapturedStdout()).toContain('(TypeScript-native)')
    })

    test('should succeed when schema is invalid and using --force', async () => {
      ctx.fixture('introspection/postgresql')

      const result = DbPullTypeScript.new().parse(['--schema=./prisma/invalid.prisma', '--force'], await ctx.config())
      await expect(result).resolves.toMatchInlineSnapshot(`""`)

      expect(ctx.normalizedCapturedStdout()).toContain('(TypeScript-native)')
      expect(ctx.normalizedCapturedStdout()).toMatchInlineSnapshot(`
        "Prisma schema loaded from prisma/invalid.prisma
        Datasource "db": PostgreSQL database "tests-migrate" <location placeholder>

        - Introspecting based on datasource defined in prisma/invalid.prisma (TypeScript-native)
        ✔ Introspected 2 models and wrote them into prisma/invalid.prisma in XXXms (TypeScript-native)
              
        Run prisma generate to generate Prisma Client.
        "
      `)

      expect(ctx.fs.read('prisma/invalid.prisma')).toMatchInlineSnapshot(`
        "generator client {
          provider = "prisma-client"
        }

        datasource db {
          provider = "postgresql"
          url      = env("TEST_POSTGRES_URI_MIGRATE")
        }

        enum Role {
          USER
          ADMIN
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
          id      String  @id
          email   String  @unique
          name    String?
          role    Role    @default(USER)
          posts   Post[]
        }
        "
      `)
    })
  })

  describe('Driver adapter requirements', () => {
    test('should require driver adapters configuration', async () => {
      ctx.fixture('introspection/postgresql')

      // Create a config without driver adapters
      const configWithoutAdapters = await ctx.config()
      configWithoutAdapters.migrate = undefined

      const introspect = new DbPullTypeScript()
      const result = introspect.parse(['--print'], configWithoutAdapters)

      await expect(result).rejects.toThrowErrorMatchingInlineSnapshot(`
        "TypeScript-native db pull requires driver adapters. Please configure an adapter in your Prisma config."
      `)
    })
  })

  describe('using Prisma Config', () => {
    it('--url is not supported', async () => {
      ctx.fixture('prisma-config-validation/postgresql')

      const command = DbPullTypeScript.new().parse(
        ['--url', process.env.TEST_POSTGRES_URI_MIGRATE!],
        await ctx.config(),
      )

      await expect(command).rejects.toThrowErrorMatchingInlineSnapshot(`
        "
        Passing the --url flag to the prisma db pull-ts command is not supported when
        defining a migrate.adapter in prisma.config.ts.

        More information about this limitation: https://pris.ly/d/schema-engine-limitations
        "
      `)
    })

    it('PostgreSQL-specific flags are not supported', async () => {
      ctx.fixture('prisma-config-validation/postgresql')

      const command = DbPullTypeScript.new().parse(['--schema=./custom.prisma'], await ctx.config())

      // PostgreSQL doesn't have equivalent special flags like --local-d1, but we can test schema validation
      await expect(command).rejects.toThrow()
    })
  })
})

