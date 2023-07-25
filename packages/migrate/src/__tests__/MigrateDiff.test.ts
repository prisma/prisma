// describeIf is making eslint unhappy about the test names
/* eslint-disable jest/no-identical-title */

import { jestConsoleContext, jestContext } from '@prisma/get-platform'

import { MigrateDiff } from '../commands/MigrateDiff'
import { setupCockroach, tearDownCockroach } from '../utils/setupCockroach'
import { setupMSSQL, tearDownMSSQL } from '../utils/setupMSSQL'
import { setupMysql, tearDownMysql } from '../utils/setupMysql'
import type { SetupParams } from '../utils/setupPostgres'
import { setupPostgres, tearDownPostgres } from '../utils/setupPostgres'

const ctx = jestContext.new().add(jestConsoleContext()).assemble()
const describeIf = (condition: boolean) => (condition ? describe : describe.skip)

const originalEnv = { ...process.env }

describe('migrate diff', () => {
  describe('generic', () => {
    it('should fail if missing --from-... and --to-...', async () => {
      ctx.fixture('empty')

      const result = MigrateDiff.new().parse([])
      await expect(result).rejects.toThrow()
    })

    it('should fail if only --from-... is provided', async () => {
      ctx.fixture('empty')

      const result = MigrateDiff.new().parse(['--from-empty'])
      await expect(result).rejects.toThrow()
    })

    it('should fail if only --to-... is provided', async () => {
      ctx.fixture('empty')

      const result = MigrateDiff.new().parse(['--to-empty'])
      await expect(result).rejects.toThrow()
    })

    it('should fail if more than 1 --from-... is provided', async () => {
      ctx.fixture('empty')

      const result = MigrateDiff.new().parse(['--from-empty', '--from-url=file:dev.db'])
      await expect(result).rejects.toThrow()
    })

    it('should fail if more than 1 --to-... is provided', async () => {
      ctx.fixture('empty')

      const result = MigrateDiff.new().parse(['--to-empty', '--to-url=file:dev.db'])
      await expect(result).rejects.toThrow()
    })

    it('should fail if schema does no exists, --from-schema-datasource', async () => {
      ctx.fixture('empty')
      expect.assertions(2)

      try {
        await MigrateDiff.new().parse(['--from-schema-datasource=./doesnoexists.prisma', '--to-empty'])
      } catch (e) {
        expect(e.code).toEqual(undefined)
        expect(e.message).toContain(`Error trying to read Prisma schema file at`)
      }
    })

    it('should fail for empty/empty', async () => {
      ctx.fixture('empty')
      expect.assertions(2)

      try {
        await MigrateDiff.new().parse(['--from-empty', '--to-empty'])
      } catch (e) {
        expect(e.code).toEqual(undefined)
        expect(e.message).toMatchInlineSnapshot(`
          Could not determine the connector to use for diffing.


        `)
      }
    })
  })

  describe('sqlite', () => {
    it('should fail --from-empty --to-url=file:doesnotexists.db', async () => {
      ctx.fixture('schema-only-sqlite')

      const result = MigrateDiff.new().parse(['--from-empty', '--to-url=file:doesnotexists.db'])
      await expect(result).rejects.toMatchInlineSnapshot(`
              P1003

              Database doesnotexists.db does not exist at doesnotexists.db

            `)
      expect(ctx.mocked['console.info'].mock.calls.join('\n')).toMatchInlineSnapshot(``)
    })
    it('should fail --from-url=file:doesnotexists.db --to-empty ', async () => {
      ctx.fixture('schema-only-sqlite')

      const result = MigrateDiff.new().parse(['--from-url=file:doesnotexists.db', '--to-empty'])
      await expect(result).rejects.toMatchInlineSnapshot(`
              P1003

              Database doesnotexists.db does not exist at doesnotexists.db

            `)
      expect(ctx.mocked['console.info'].mock.calls.join('\n')).toMatchInlineSnapshot(``)
    })
    it('should fail if directory in path & sqlite file does not exist', async () => {
      ctx.fixture('schema-only-sqlite')

      const result = MigrateDiff.new().parse(['--from-url=file:./something/doesnotexists.db', '--to-empty'])
      await expect(result).rejects.toMatchInlineSnapshot(`
              P1003

              Database doesnotexists.db does not exist at ./something/doesnotexists.db

            `)
      expect(ctx.mocked['console.error'].mock.calls.join('\n')).toMatchInlineSnapshot(``)
      expect(ctx.mocked['console.info'].mock.calls.join('\n')).toMatchInlineSnapshot(``)
    })

    it('should diff --from-empty --to-url=file:dev.db', async () => {
      ctx.fixture('introspection/sqlite')

      const result = MigrateDiff.new().parse(['--from-empty', '--to-url=file:dev.db'])
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

      const result = MigrateDiff.new().parse(['--from-empty', '--to-url=file:dev.db', '--script'])
      await expect(result).resolves.toMatchInlineSnapshot(``)
      expect(ctx.mocked['console.info'].mock.calls.join('\n')).toMatchSnapshot()
    })

    it('should diff --from-empty --to-schema-datamodel=./prisma/schema.prisma', async () => {
      ctx.fixture('schema-only-sqlite')

      const result = MigrateDiff.new().parse(['--from-empty', '--to-schema-datamodel=./prisma/schema.prisma'])
      await expect(result).resolves.toMatchInlineSnapshot(``)
      expect(ctx.mocked['console.info'].mock.calls.join('\n')).toMatchInlineSnapshot(`

                                                                                                                        [+] Added tables
                                                                                                                          - Blog
                                                                                          `)
    })
    it('should diff --from-empty --to-schema-datamodel=./prisma/schema.prisma --script', async () => {
      ctx.fixture('schema-only-sqlite')

      const result = MigrateDiff.new().parse([
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

      const result = MigrateDiff.new().parse(['--from-schema-datamodel=./prisma/schema.prisma', '--to-empty'])
      await expect(result).resolves.toMatchInlineSnapshot(``)
      expect(ctx.mocked['console.info'].mock.calls.join('\n')).toMatchInlineSnapshot(`

                                                                                                                        [-] Removed tables
                                                                                                                          - Blog
                                                                                          `)
    })
    it('should diff --from-schema-datamodel=./prisma/schema.prisma --to-empty --script', async () => {
      ctx.fixture('schema-only-sqlite')

      const result = MigrateDiff.new().parse([
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
      // Create empty file, as the file needs to exists
      ctx.fs.write('dev.db', '')

      const result = MigrateDiff.new().parse(['--from-url=file:dev.db', '--to-url=file:dev.db'])
      await expect(result).resolves.toMatchInlineSnapshot(``)
      expect(ctx.mocked['console.info'].mock.calls.join('\n')).toMatchInlineSnapshot(`No difference detected.`)
    })

    describe('--exit-code', () => {
      it('should exit with code 2 when diff is not empty without --script', async () => {
        ctx.fixture('schema-only-sqlite')

        const mockExit = jest.spyOn(process, 'exit').mockImplementation((number) => {
          throw new Error('process.exit: ' + number)
        })

        const result = MigrateDiff.new().parse([
          '--from-schema-datamodel=./prisma/schema.prisma',
          '--to-empty',
          '--exit-code',
        ])

        await expect(result).rejects.toMatchInlineSnapshot(`process.exit: 2`)
        expect(ctx.mocked['console.error'].mock.calls.join('\n')).toMatchInlineSnapshot(``)
        expect(ctx.mocked['console.info'].mock.calls.join('\n')).toMatchInlineSnapshot(`

                                                                                [-] Removed tables
                                                                                  - Blog
                                                                `)

        expect(mockExit).toHaveBeenCalledTimes(1)
        expect(mockExit).toHaveBeenCalledWith(2)
        mockExit.mockRestore()
      })

      it('should exit with code 2 when diff is not empty with --script', async () => {
        ctx.fixture('schema-only-sqlite')

        const mockExit = jest.spyOn(process, 'exit').mockImplementation((number) => {
          throw new Error('process.exit: ' + number)
        })

        const result = MigrateDiff.new().parse([
          '--from-schema-datamodel=./prisma/schema.prisma',
          '--to-empty',
          '--script',
          '--exit-code',
        ])

        await expect(result).rejects.toMatchInlineSnapshot(`process.exit: 2`)
        expect(ctx.mocked['console.error'].mock.calls.join('\n')).toMatchInlineSnapshot(``)
        expect(ctx.mocked['console.info'].mock.calls.join('\n')).toMatchInlineSnapshot(`
          -- DropTable
          PRAGMA foreign_keys=off;
          DROP TABLE "Blog";
          PRAGMA foreign_keys=on;
        `)

        expect(mockExit).toHaveBeenCalledTimes(1)
        expect(mockExit).toHaveBeenCalledWith(2)
        mockExit.mockRestore()
      })

      it('should exit with code 0 when diff is empty with --script', async () => {
        ctx.fixture('empty')
        // Create empty file, as the file needs to exists
        ctx.fs.write('dev.db', '')

        const result = MigrateDiff.new().parse(['--from-empty', '--to-url=file:dev.db', '--script', '--exit-code'])

        await expect(result).resolves.toMatchInlineSnapshot(``)
        expect(ctx.mocked['console.info'].mock.calls.join('\n')).toMatchInlineSnapshot(`-- This is an empty migration.`)
      })
    })
  })

  describe('mongodb', () => {
    // it('should diff --from-url=$TEST_MONGO_URI --to-schema-datamodel=./prisma/schema.prisma', async () => {
    //   ctx.fixture('schema-only-mongodb')

    //   const result = MigrateDiff.new().parse([
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

      const result = MigrateDiff.new().parse(['--from-empty', '--to-schema-datamodel=./prisma/schema.prisma'])
      await expect(result).resolves.toMatchInlineSnapshot(``)
      expect(ctx.mocked['console.info'].mock.calls.join('\n')).toMatchInlineSnapshot(`[+] Collection \`User\``)
    })

    it('should diff --from-schema-datamodel=./prisma/schema.prisma --to-empty', async () => {
      ctx.fixture('schema-only-mongodb')

      const result = MigrateDiff.new().parse(['--from-schema-datamodel=./prisma/schema.prisma', '--to-empty'])
      await expect(result).resolves.toMatchInlineSnapshot(``)
      expect(ctx.mocked['console.info'].mock.calls.join('\n')).toMatchInlineSnapshot(`No difference detected.`)
    })

    it('should fail with not supported error with --script', async () => {
      ctx.fixture('schema-only-mongodb')

      const result = MigrateDiff.new().parse([
        '--from-empty',
        '--to-schema-datamodel=./prisma/schema.prisma',
        '--script',
      ])
      await expect(result).rejects.toThrowErrorMatchingInlineSnapshot(`
              Rendering to a script is not supported on MongoDB.


            `)
    })
  })

  describeIf(!process.env.TEST_SKIP_COCKROACHDB)('cockroachdb', () => {
    if (!process.env.TEST_SKIP_COCKROACHDB && !process.env.TEST_COCKROACH_URI_MIGRATE) {
      throw new Error('You must set a value for process.env.TEST_COCKROACH_URI_MIGRATE. See TESTING.md')
    }
    const connectionString = process.env.TEST_COCKROACH_URI_MIGRATE?.replace('tests-migrate', 'tests-migrate-diff')
    const setupParams = {
      connectionString: connectionString!,
      dirname: '',
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
      process.env.TEST_POSTGRES_URI_MIGRATE = connectionString
    })

    afterEach(async () => {
      // Back to original env vars
      process.env = { ...originalEnv }
      await tearDownCockroach(setupParams).catch((e) => {
        console.error(e)
      })
    })

    it('should diff --from-url=connectionString --to-schema-datamodel=./prisma/schema.prisma --script', async () => {
      ctx.fixture('schema-only-cockroachdb')

      const result = MigrateDiff.new().parse([
        '--from-url',
        connectionString!,
        '--to-schema-datamodel=./prisma/schema.prisma',
        '--script',
      ])
      await expect(result).resolves.toMatchInlineSnapshot(``)
      expect(ctx.mocked['console.info'].mock.calls.join('\n')).toMatchInlineSnapshot(`
        -- CreateTable
        CREATE TABLE "Blog" (
            "id" INT4 NOT NULL,
            "viewCount20" INT4 NOT NULL,

            CONSTRAINT "Blog_pkey" PRIMARY KEY ("id")
        );
      `)
    })

    it('should use env var from .env file with --from-schema-datasource', async () => {
      ctx.fixture('schema-only-cockroachdb')

      const result = MigrateDiff.new().parse([
        '--from-schema-datasource=./prisma/using-dotenv.prisma',
        '--to-schema-datamodel=./prisma/schema.prisma',
      ])
      await expect(result).rejects.toMatchInlineSnapshot(`
              P1001

              Can't reach database server at \`fromdotenvdoesnotexist\`:\`26257\`

              Please make sure your database server is running at \`fromdotenvdoesnotexist\`:\`26257\`.

            `)
    })

    it('should fail for 2 different connectors --from-url=connectionString --to-url=file:dev.db --script', async () => {
      ctx.fixture('introspection/sqlite')

      const result = MigrateDiff.new().parse(['--from-url', connectionString!, '--to-url=file:dev.db', '--script'])
      await expect(result).rejects.toThrowErrorMatchingInlineSnapshot(`
              Error in Schema engine.
              Reason: [/some/rust/path:0:0] called \`Option::unwrap()\` on a \`None\` value

            `)
    })
  })

  describe('postgresql', () => {
    const connectionString = process.env.TEST_POSTGRES_URI_MIGRATE!.replace('tests-migrate', 'tests-migrate-diff')

    const setupParams: SetupParams = {
      connectionString,
      dirname: '',
    }

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

    it('should diff --from-url=connectionString --to-schema-datamodel=./prisma/schema.prisma --script', async () => {
      ctx.fixture('schema-only-postgresql')

      const result = MigrateDiff.new().parse([
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

    it('should use env var from .env file with --from-schema-datasource', async () => {
      ctx.fixture('schema-only-postgresql')

      const result = MigrateDiff.new().parse([
        '--from-schema-datasource=./prisma/using-dotenv.prisma',
        '--to-schema-datamodel=./prisma/schema.prisma',
      ])
      await expect(result).rejects.toMatchInlineSnapshot(`
              P1001

              Can't reach database server at \`fromdotenvdoesnotexist\`:\`5432\`

              Please make sure your database server is running at \`fromdotenvdoesnotexist\`:\`5432\`.

            `)
    })

    it('should fail for 2 different connectors --from-url=connectionString --to-url=file:dev.db --script', async () => {
      ctx.fixture('introspection/sqlite')

      const result = MigrateDiff.new().parse(['--from-url', connectionString, '--to-url=file:dev.db', '--script'])
      await expect(result).rejects.toThrowErrorMatchingInlineSnapshot(`
        Error in Schema engine.
        Reason: [/some/rust/path:0:0] called \`Option::unwrap()\` on a \`None\` value

      `)
    })

    it('should work if directUrl is set as an env var', async () => {
      ctx.fixture('schema-only-data-proxy')
      const result = MigrateDiff.new().parse(['--from-schema-datasource', 'with-directUrl-env.prisma', '--to-empty'])
      await expect(result).resolves.toMatchInlineSnapshot(``)
      expect(ctx.mocked['console.info'].mock.calls.join('\n')).toMatchInlineSnapshot(`No difference detected.`)
      expect(ctx.mocked['console.error'].mock.calls.join('\n')).toMatchInlineSnapshot(``)
    })
  })

  describe('mysql', () => {
    const databaseName = 'tests-migrate-diff'
    const connectionString = process.env.TEST_MYSQL_URI_MIGRATE!.replace('tests-migrate', databaseName)

    const setupParams: SetupParams = {
      connectionString,
      dirname: '',
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

    it('should diff --from-url=connectionString --to-schema-datamodel=./prisma/schema.prisma --script', async () => {
      ctx.fixture('schema-only-mysql')

      const result = MigrateDiff.new().parse([
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

      const result = MigrateDiff.new().parse(['--from-url', connectionString, '--to-url=file:dev.db', '--script'])
      await expect(result).rejects.toThrowErrorMatchingInlineSnapshot(`
        Error in Schema engine.
        Reason: [/some/rust/path:0:0] Column native type missing in mysql_renderer::render_column_type()

      `)
    })
  })

  describeIf(!process.env.TEST_SKIP_MSSQL)('sqlserver', () => {
    if (!process.env.TEST_SKIP_MSSQL && !process.env.TEST_MSSQL_JDBC_URI_MIGRATE) {
      throw new Error('You must set a value for process.env.TEST_MSSQL_JDBC_URI_MIGRATE. See TESTING.md')
    }
    const databaseName = 'tests-migrate-diff'
    const jdbcConnectionString = process.env.TEST_MSSQL_JDBC_URI_MIGRATE?.replace('tests-migrate', databaseName)

    const setupParams: SetupParams = {
      connectionString: process.env.TEST_MSSQL_URI!,
      dirname: '',
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

    it('should diff --from-url=connectionString --to-schema-datamodel=./prisma/schema.prisma --script', async () => {
      ctx.fixture('schema-only-sqlserver')

      const result = MigrateDiff.new().parse([
        '--from-url',
        jdbcConnectionString!,
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
            CONSTRAINT [Blog_pkey] PRIMARY KEY CLUSTERED ([id])
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

      const result = MigrateDiff.new().parse(['--from-url', jdbcConnectionString!, '--to-url=file:dev.db', '--script'])
      await expect(result).rejects.toThrowErrorMatchingInlineSnapshot(`
        Error in Schema engine.
        Reason: [/some/rust/path:0:0] Missing column native type in mssql_renderer::render_column_type()

      `)
    })
  })
})
