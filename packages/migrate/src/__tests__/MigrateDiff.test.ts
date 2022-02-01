import { MigrateDiff } from '../commands/MigrateDiff'
import { jestConsoleContext, jestContext } from '@prisma/sdk'
import { setupMysql, tearDownMysql } from '../utils/setupMysql'
import { setupMSSQL, tearDownMSSQL } from '../utils/setupMSSQL'
import { SetupParams, setupPostgres, tearDownPostgres } from '../utils/setupPostgres'

const ctx = jestContext.new().add(jestConsoleContext()).assemble()
const describeIf = (condition: boolean) => (condition ? describe : describe.skip)

describe('migrate diff', () => {
  describe('generic', () => {
    it('--preview-feature flag is required', async () => {
      ctx.fixture('empty')

      const result = MigrateDiff.new().parse([])
      await expect(result).rejects.toThrowErrorMatchingInlineSnapshot(
        `This command is in Preview. Use the --preview-feature flag to use it like prisma migrate diff --preview-feature`,
      )
      expect(ctx.mocked['console.warn'].mock.calls.join('\n')).toMatchInlineSnapshot(``)
    })

    it('should fail if missing --from-... and --to-...', async () => {
      ctx.fixture('empty')

      const result = MigrateDiff.new().parse(['--preview-feature'])
      await expect(result).rejects.toThrowError()
    })

    it('should fail if only --from-... is provided', async () => {
      ctx.fixture('empty')

      const result = MigrateDiff.new().parse(['--preview-feature', '--from-empty'])
      await expect(result).rejects.toThrowError()
    })

    it('should fail if only --to-... is provided', async () => {
      ctx.fixture('empty')

      const result = MigrateDiff.new().parse(['--preview-feature', '--to-empty'])
      await expect(result).rejects.toThrowError()
    })

    it('should fail if more than 1 --from-... is provided', async () => {
      ctx.fixture('empty')

      const result = MigrateDiff.new().parse(['--preview-feature', '--from-empty', '--from-url=file:dev.db'])
      await expect(result).rejects.toThrowError()
    })

    it('should fail if more than 1 --to-... is provided', async () => {
      ctx.fixture('empty')

      const result = MigrateDiff.new().parse(['--preview-feature', '--to-empty', '--to-url=file:dev.db'])
      await expect(result).rejects.toThrowError()
    })

    it('should fail if schema does no exists, --from-schema-datasource', async () => {
      ctx.fixture('empty')
      expect.assertions(2)

      try {
        await MigrateDiff.new().parse([
          '--preview-feature',
          '--from-schema-datasource=./doesnoexists.prisma',
          '--to-empty',
        ])
      } catch (e) {
        expect(e.code).toEqual(undefined)
        expect(e.message).toContain(`Error trying to read Prisma schema file at`)
      }
    })

    it('should fail for empty/empty', async () => {
      ctx.fixture('empty')
      expect.assertions(2)

      try {
        await MigrateDiff.new().parse(['--preview-feature', '--from-empty', '--to-empty'])
      } catch (e) {
        expect(e.code).toEqual(undefined)
        expect(e.message).toMatchInlineSnapshot(`
          Could not determine the connector to use for diffing.


        `)
      }
    })
  })

  describe('sqlite', () => {
    // TODO next 2 tests: is it expected to not fail when diffing from/to an unexisting sqlite db?
    it('should diff --from-empty --to-url=file:doesnotexists.db', async () => {
      ctx.fixture('schema-only-sqlite')

      const result = MigrateDiff.new().parse(['--preview-feature', '--from-empty', '--to-url=file:doesnotexists.db'])
      await expect(result).resolves.toMatchInlineSnapshot(``)
      expect(ctx.mocked['console.info'].mock.calls.join('\n')).toMatchInlineSnapshot(`No difference detected.`)
    })
    it('should diff --from-url=file:doesnotexists.db --to-empty ', async () => {
      ctx.fixture('schema-only-sqlite')

      const result = MigrateDiff.new().parse(['--preview-feature', '--from-empty', '--to-url=file:doesnotexists.db'])
      await expect(result).resolves.toMatchInlineSnapshot(``)
      expect(ctx.mocked['console.info'].mock.calls.join('\n')).toMatchInlineSnapshot(`No difference detected.`)
    })

    it('should diff --from-empty --to-url=file:dev.db', async () => {
      ctx.fixture('introspection/sqlite')

      const result = MigrateDiff.new().parse(['--preview-feature', '--from-empty', '--to-url=file:dev.db'])
      await expect(result).resolves.toMatchInlineSnapshot(``)
      expect(ctx.mocked['console.info'].mock.calls.join('\n')).toMatchInlineSnapshot(`

                                                [+] Added tables
                                                  - Post
                                                  - Profile
                                                  - User
                                                  - _Migration

                                                [*] Changed the \`Profile\` table
                                                  [+] Added unique index on columns (userId)

                                                [*] Changed the \`User\` table
                                                  [+] Added unique index on columns (email)

                                    `)
    })
    it('should diff --from-empty --to-url=file:dev.db --script', async () => {
      ctx.fixture('introspection/sqlite')

      const result = MigrateDiff.new().parse(['--preview-feature', '--from-empty', '--to-url=file:dev.db', '--script'])
      await expect(result).resolves.toMatchInlineSnapshot(``)
      expect(ctx.mocked['console.info'].mock.calls.join('\n')).toMatchSnapshot()
    })

    it('should diff --from-empty --to-schema-datamodel=./prisma/schema.prisma', async () => {
      ctx.fixture('schema-only-sqlite')

      const result = MigrateDiff.new().parse([
        '--preview-feature',
        '--from-empty',
        '--to-schema-datamodel=./prisma/schema.prisma',
      ])
      await expect(result).resolves.toMatchInlineSnapshot(``)
      expect(ctx.mocked['console.info'].mock.calls.join('\n')).toMatchInlineSnapshot(`

                                                                                        [+] Added tables
                                                                                          - Blog

                                                                  `)
    })
    it('should diff --from-empty --to-schema-datamodel=./prisma/schema.prisma --script', async () => {
      ctx.fixture('schema-only-sqlite')

      const result = MigrateDiff.new().parse([
        '--preview-feature',
        '--from-empty',
        '--to-schema-datamodel=./prisma/schema.prisma',
        '--script',
      ])
      await expect(result).resolves.toMatchInlineSnapshot(``)
      expect(ctx.mocked['console.info'].mock.calls.join('\n')).toMatchInlineSnapshot(`
        -- CreateTable
        CREATE TABLE "Blog" (
            "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
            "viewCount20" INTEGER NOT NULL
        );

      `)
    })

    it('should diff --from-schema-datamodel=./prisma/schema.prisma --to-empty', async () => {
      ctx.fixture('schema-only-sqlite')

      const result = MigrateDiff.new().parse([
        '--preview-feature',
        '--from-schema-datamodel=./prisma/schema.prisma',
        '--to-empty',
      ])
      await expect(result).resolves.toMatchInlineSnapshot(``)
      expect(ctx.mocked['console.info'].mock.calls.join('\n')).toMatchInlineSnapshot(`

                                                                                                [-] Removed tables
                                                                                                  - Blog

                                                                        `)
    })
    it('should diff --from-schema-datamodel=./prisma/schema.prisma --to-empty --script', async () => {
      ctx.fixture('schema-only-sqlite')

      const result = MigrateDiff.new().parse([
        '--preview-feature',
        '--from-schema-datamodel=./prisma/schema.prisma',
        '--to-empty',
        '--script',
      ])
      await expect(result).resolves.toMatchInlineSnapshot(``)
      expect(ctx.mocked['console.info'].mock.calls.join('\n')).toMatchInlineSnapshot(`
        -- DropTable
        PRAGMA foreign_keys=off;
        DROP TABLE "Blog";
        PRAGMA foreign_keys=on;

      `)
    })

    it('should pass if no schema file around', async () => {
      ctx.fixture('empty')

      const result = MigrateDiff.new().parse(['--preview-feature', '--from-url=file:dev.db', '--to-url=file:dev.db'])
      await expect(result).resolves.toMatchInlineSnapshot(``)
      expect(ctx.mocked['console.info'].mock.calls.join('\n')).toMatchInlineSnapshot(`No difference detected.`)
    })
  })

  describe('mongodb', () => {
    // it('should diff --from-url=$TEST_MONGO_URI --to-schema-datamodel=./prisma/schema.prisma', async () => {
    //   ctx.fixture('schema-only-mongodb')

    //   const result = MigrateDiff.new().parse([
    //     '--preview-feature',
    //     '--from-url',
    //     process.env.TEST_MONGO_URI!,
    //     // '--to-empty',
    //     '--to-schema-datamodel=./prisma/schema.prisma',
    //   ])
    //   await expect(result).resolves.toMatchInlineSnapshot(``)
    //   expect(ctx.mocked['console.info'].mock.calls.join('\n')).toMatchInlineSnapshot(`
    //     [+] Collection \`User\`

    //   `)
    // })

    it('should diff --from-empty --to-schema-datamodel=./prisma/schema.prisma', async () => {
      ctx.fixture('schema-only-mongodb')

      const result = MigrateDiff.new().parse([
        '--preview-feature',
        '--from-empty',
        '--to-schema-datamodel=./prisma/schema.prisma',
      ])
      await expect(result).resolves.toMatchInlineSnapshot(``)
      expect(ctx.mocked['console.info'].mock.calls.join('\n')).toMatchInlineSnapshot(`
        [+] Collection \`User\`

      `)
    })

    it('should diff --from-schema-datamodel=./prisma/schema.prisma --to-empty', async () => {
      ctx.fixture('schema-only-mongodb')

      const result = MigrateDiff.new().parse([
        '--preview-feature',
        '--from-schema-datamodel=./prisma/schema.prisma',
        '--to-empty',
      ])
      await expect(result).resolves.toMatchInlineSnapshot(``)
      expect(ctx.mocked['console.info'].mock.calls.join('\n')).toMatchInlineSnapshot(`No difference detected.`)
    })

    it('should fail with not supported error with --script', async () => {
      ctx.fixture('schema-only-mongodb')

      const result = MigrateDiff.new().parse([
        '--preview-feature',
        '--from-empty',
        '--to-schema-datamodel=./prisma/schema.prisma',
        '--script',
      ])
      await expect(result).rejects.toThrowErrorMatchingInlineSnapshot(`
              Rendering to a script is not supported on MongoDB.


            `)
    })
  })

  describe('postgresql', () => {
    const connectionString = (
      process.env.TEST_POSTGRES_URI_MIGRATE || 'postgres://prisma:prisma@localhost:5432/tests-migrate'
    ).replace('tests-migrate', 'tests-migrate-diff')

    // Update env var because it's the one that is used in the schemas tested
    process.env.TEST_POSTGRES_URI_MIGRATE = connectionString

    const setupParams: SetupParams = {
      connectionString,
      dirname: '',
    }

    beforeAll(async () => {
      await setupPostgres(setupParams).catch((e) => {
        console.error(e)
      })
    })

    afterAll(async () => {
      await tearDownPostgres(setupParams).catch((e) => {
        console.error(e)
      })
    })

    it('should diff --from-url=connectionString --to-schema-datamodel=./prisma/schema.prisma --script', async () => {
      ctx.fixture('schema-only-postgresql')

      const result = MigrateDiff.new().parse([
        '--preview-feature',
        '--from-url',
        connectionString,
        '--to-schema-datamodel=./prisma/schema.prisma',
        '--script',
      ])
      await expect(result).resolves.toMatchInlineSnapshot(``)
      expect(ctx.mocked['console.info'].mock.calls.join('\n')).toMatchInlineSnapshot(`
        -- CreateTable
        CREATE TABLE "Blog" (
            "id" INTEGER NOT NULL,
            "viewCount20" INTEGER NOT NULL,

            CONSTRAINT "Blog_pkey" PRIMARY KEY ("id")
        );

      `)
    })

    it('should diff when using env var from .env file --from-schema-datasource --to-schema-datamodel=./prisma/schema.prisma', async () => {
      ctx.fixture('schema-only-postgresql')
      process.env.TEST_POSTGRES_URI_MIGRATE_FOR_DOTENV_TEST = connectionString

      const result = MigrateDiff.new().parse([
        '--preview-feature',
        '--from-schema-datasource=./prisma/using-dotenv.prisma',
        '--to-schema-datamodel=./prisma/schema.prisma',
      ])
      await expect(result).resolves.toMatchInlineSnapshot(``)
      expect(ctx.mocked['console.info'].mock.calls.join('\n')).toMatchInlineSnapshot(`

        [+] Added tables
          - Blog

      `)
    })

    it('should fail for 2 different connectors --from-url=connectionString --to-url=file:dev.db --script', async () => {
      ctx.fixture('introspection/sqlite')

      const result = MigrateDiff.new().parse([
        '--preview-feature',
        '--from-url',
        connectionString,
        '--to-url=file:dev.db',
        '--script',
      ])
      await expect(result).rejects.toThrowErrorMatchingInlineSnapshot(`
              Error in migration engine.
              Reason: [/some/rust/path:0:0] Missing native type in postgres_renderer::render_column_type()

              Please create an issue with your \`schema.prisma\` at
              https://github.com/prisma/prisma/issues/new

            `)
    })
  })

  describe('mysql', () => {
    const connectionString = (
      process.env.TEST_MYSQL_URI_MIGRATE || 'mysql://root:root@localhost:3306/tests-migrate'
    ).replace('tests-migrate', 'tests-migrate-diff')

    // Update env var because it's the one that is used in the schemas tested
    process.env.TEST_MYSQL_URI_MIGRATE = connectionString

    const setupParams: SetupParams = {
      connectionString,
      dirname: '',
    }

    beforeAll(async () => {
      await setupMysql(setupParams).catch((e) => {
        console.error(e)
      })
    })

    afterAll(async () => {
      await tearDownMysql(setupParams).catch((e) => {
        console.error(e)
      })
    })

    it('should diff --from-url=connectionString --to-schema-datamodel=./prisma/schema.prisma --script', async () => {
      ctx.fixture('schema-only-mysql')

      const result = MigrateDiff.new().parse([
        '--preview-feature',
        '--from-url',
        connectionString,
        '--to-schema-datamodel=./prisma/schema.prisma',
        '--script',
      ])
      await expect(result).resolves.toMatchInlineSnapshot(``)
      expect(ctx.mocked['console.info'].mock.calls.join('\n')).toMatchInlineSnapshot(`
        -- CreateTable
        CREATE TABLE \`Blog\` (
            \`id\` INTEGER NOT NULL,
            \`viewCount20\` INTEGER NOT NULL,

            PRIMARY KEY (\`id\`)
        ) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

      `)
    })

    it('should fail for 2 different connectors --from-url=connectionString --to-url=file:dev.db --script', async () => {
      ctx.fixture('introspection/sqlite')

      const result = MigrateDiff.new().parse([
        '--preview-feature',
        '--from-url',
        connectionString,
        '--to-url=file:dev.db',
        '--script',
      ])
      await expect(result).rejects.toThrowErrorMatchingInlineSnapshot(`
              Error in migration engine.
              Reason: [/some/rust/path:0:0] Column native type missing in mysql_renderer::render_column_type()

              Please create an issue with your \`schema.prisma\` at
              https://github.com/prisma/prisma/issues/new

            `)
    })
  })

  describeIf(!process.env.TEST_SKIP_MSSQL)('sqlserver', () => {
    const jdbcConnectionString = (
      process.env.TEST_MSSQL_JDBC_URI_MIGRATE ||
      'sqlserver://mssql:1433;database=tests-migrate;user=SA;password=Pr1sm4_Pr1sm4;trustServerCertificate=true;'
    ).replace('tests-migrate', 'tests-migrate-diff')

    // Update env var because it's the one that is used in the schemas tested
    process.env.TEST_MSSQL_JDBC_URI_MIGRATE = jdbcConnectionString

    const setupParams: SetupParams = {
      connectionString: process.env.TEST_MSSQL_URI!,
      dirname: '',
    }

    beforeAll(async () => {
      await setupMSSQL(setupParams, 'tests-migrate-diff').catch((e) => {
        console.error(e)
      })
    })

    afterAll(async () => {
      await tearDownMSSQL(setupParams, 'tests-migrate-diff').catch((e) => {
        console.error(e)
      })
    })

    it('should diff --from-url=connectionString --to-schema-datamodel=./prisma/schema.prisma --script', async () => {
      ctx.fixture('schema-only-sqlserver')

      const result = MigrateDiff.new().parse([
        '--preview-feature',
        '--from-url',
        jdbcConnectionString,
        '--to-schema-datamodel=./prisma/schema.prisma',
        '--script',
      ])
      await expect(result).resolves.toMatchInlineSnapshot(``)
      expect(ctx.mocked['console.info'].mock.calls.join('\n')).toMatchInlineSnapshot(`
        BEGIN TRY

        BEGIN TRAN;

        -- CreateTable
        CREATE TABLE [dbo].[Blog] (
            [id] INT NOT NULL,
            [viewCount20] INT NOT NULL,
            CONSTRAINT [Blog_pkey] PRIMARY KEY ([id])
        );

        COMMIT TRAN;

        END TRY
        BEGIN CATCH

        IF @@TRANCOUNT > 0
        BEGIN
            ROLLBACK TRAN;
        END;
        THROW

        END CATCH

      `)
    })

    it('should fail for 2 different connectors --from-url=jdbcConnectionString --to-url=file:dev.db --script', async () => {
      ctx.fixture('introspection/sqlite')

      const result = MigrateDiff.new().parse([
        '--preview-feature',
        '--from-url',
        jdbcConnectionString,
        '--to-url=file:dev.db',
        '--script',
      ])
      await expect(result).rejects.toThrowErrorMatchingInlineSnapshot(`
              Error in migration engine.
              Reason: [/some/rust/path:0:0] Missing column native type in mssql_renderer::render_column_type()

              Please create an issue with your \`schema.prisma\` at
              https://github.com/prisma/prisma/issues/new

            `)
    })
  })
})
