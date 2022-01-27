import path from 'path'
import fs from 'fs'
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
        `This command is in Preview. Use the --preview-feature flag to use it like prisma db execute --preview-feature`,
      )
      expect(ctx.mocked['console.warn'].mock.calls.join('\n')).toMatchInlineSnapshot(``)
    })

    it('should fail if missing --from-... and --to-...', async () => {
      ctx.fixture('empty')

      const result = MigrateDiff.new().parse(['--preview-feature'])
      await expect(result).rejects.toThrowErrorMatchingInlineSnapshot(`
              0 \`--from-...\` paramater(s) provided. 1 must be provided.
              0 \`--to-...\` paramater(s) provided. 1 must be provided.
              See prisma migrate diff -h
            `)
    })

    it('should fail if only --from-... is provided', async () => {
      ctx.fixture('empty')

      const result = MigrateDiff.new().parse(['--preview-feature', '--from-empty'])
      await expect(result).rejects.toThrowErrorMatchingInlineSnapshot(`
              0 \`--to-...\` paramater(s) provided. 1 must be provided.
              See prisma migrate diff -h
            `)
    })

    it('should fail if only --to-... is provided', async () => {
      ctx.fixture('empty')

      const result = MigrateDiff.new().parse(['--preview-feature', '--to-empty'])
      await expect(result).rejects.toThrowErrorMatchingInlineSnapshot(`
              0 \`--from-...\` paramater(s) provided. 1 must be provided.
              See prisma migrate diff -h
            `)
    })

    it('should fail if more than 1 --from-... is provided', async () => {
      ctx.fixture('empty')

      const result = MigrateDiff.new().parse(['--preview-feature', '--from-empty', '--from-url=file:dev.db'])
      await expect(result).rejects.toThrowErrorMatchingInlineSnapshot(`
              2 \`--from-...\` paramater(s) provided. 1 must be provided.
              0 \`--to-...\` paramater(s) provided. 1 must be provided.
              See prisma migrate diff -h
            `)
    })

    it('should fail if more than 1 --to-... is provided', async () => {
      ctx.fixture('empty')

      const result = MigrateDiff.new().parse(['--preview-feature', '--to-empty', '--to-url=file:dev.db'])
      await expect(result).rejects.toThrowErrorMatchingInlineSnapshot(`
              0 \`--from-...\` paramater(s) provided. 1 must be provided.
              2 \`--to-...\` paramater(s) provided. 1 must be provided.
              See prisma migrate diff -h
            `)
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
        expect(e.message).toMatchInlineSnapshot(`
          Could not find a schema.prisma file that is required for this command.
          You can either provide it with --schema, set it as \`prisma.schema\` in your package.json or put it into the default location ./prisma/schema.prisma https://pris.ly/d/prisma-schema-location
        `)
      }
    })
  })

  describe('mongodb', () => {
    it('should diff', async () => {
      ctx.fixture('schema-only-mongodb')

      const result = MigrateDiff.new().parse([
        '--preview-feature',
        '--from-empty',
        '--to-empty',
        // '--to-schema-datamodel=./prisma/schema.prisma',
      ])
      await expect(result).resolves.toMatchInlineSnapshot(``)
      expect(ctx.mocked['console.info'].mock.calls.join('\n')).toMatchInlineSnapshot(``)
    })

    it('should fail with not supported error with --script', async () => {
      ctx.fixture('schema-only-mongodb')

      const result = MigrateDiff.new().parse([
        '--preview-feature',
        '--from-empty',
        '--to-empty',
        // '--to-schema-datamodel=./prisma/schema.prisma',
        '--script',
      ])
      await expect(result).rejects.toThrowErrorMatchingInlineSnapshot(`
              Error in migration engine.
              Reason: [/some/rust/path:0:0] internal error: entered unreachable code

              Please create an issue with your \`schema.prisma\` at
              https://github.com/prisma/prisma/issues/new

            `)
    })
  })

  describe('sqlite', () => {
    // TODO next 2 tests: is it expected to not fail when diffing from/to an unexisting sqlite db?
    it('should diff --from-empty --to-url=file:doesnotexists.db', async () => {
      ctx.fixture('schema-only-sqlite')

      const result = MigrateDiff.new().parse(['--preview-feature', '--from-empty', '--to-url=file:doesnotexists.db'])
      await expect(result).resolves.toMatchInlineSnapshot(``)
      expect(ctx.mocked['console.info'].mock.calls.join('\n')).toMatchInlineSnapshot(``)
    })
    it('should diff --from-url=file:doesnotexists.db --to-empty ', async () => {
      ctx.fixture('schema-only-sqlite')

      const result = MigrateDiff.new().parse(['--preview-feature', '--from-empty', '--to-url=file:doesnotexists.db'])
      await expect(result).resolves.toMatchInlineSnapshot(``)
      expect(ctx.mocked['console.info'].mock.calls.join('\n')).toMatchInlineSnapshot(``)
    })

    it('should diff --from-empty --to-url=file:dev.db', async () => {
      ctx.fixture('schema-only-sqlite')

      const result = MigrateDiff.new().parse(['--preview-feature', '--from-empty', '--to-url=file:dev.db'])
      await expect(result).resolves.toMatchInlineSnapshot(``)
      expect(ctx.mocked['console.info'].mock.calls.join('\n')).toMatchInlineSnapshot(``)
    })
    it('should diff --from-empty --to-url=file:dev.db --script', async () => {
      ctx.fixture('introspection/sqlite')

      const result = MigrateDiff.new().parse(['--preview-feature', '--from-empty', '--to-url=file:dev.db', '--script'])
      await expect(result).resolves.toMatchInlineSnapshot(``)
      expect(ctx.mocked['console.info'].mock.calls.join('\n')).toMatchSnapshot()
    })

    it('should diff --from-empty --to-schema-datamodel=./schema.prisma', async () => {
      ctx.fixture('schema-only-sqlite')

      const result = MigrateDiff.new().parse([
        '--preview-feature',
        '--from-empty',
        '--to-schema-datamodel=./schema.prisma',
      ])
      await expect(result).resolves.toMatchInlineSnapshot(``)
      expect(ctx.mocked['console.info'].mock.calls.join('\n')).toMatchInlineSnapshot(`

        [+] Added tables
          - Blog

      `)
    })
    it('should diff --from-empty --to-schema-datamodel=./schema.prisma --script', async () => {
      ctx.fixture('schema-only-sqlite')

      const result = MigrateDiff.new().parse([
        '--preview-feature',
        '--from-empty',
        '--to-schema-datamodel=./schema.prisma',
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

    it('should diff --from-schema-datamodel=./schema.prisma --to-empty', async () => {
      ctx.fixture('schema-only-sqlite')

      const result = MigrateDiff.new().parse([
        '--preview-feature',
        '--from-schema-datamodel=./schema.prisma',
        '--to-empty',
      ])
      await expect(result).resolves.toMatchInlineSnapshot(``)
      expect(ctx.mocked['console.info'].mock.calls.join('\n')).toMatchInlineSnapshot(`

                [-] Removed tables
                  - Blog

            `)
    })
    it('should diff --from-schema-datamodel=./schema.prisma --to-empty --script', async () => {
      ctx.fixture('schema-only-sqlite')

      const result = MigrateDiff.new().parse([
        '--preview-feature',
        '--from-schema-datamodel=./schema.prisma',
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

    // TODO remove later
    it('should fail for legacy reasons if no schema file around', async () => {
      ctx.fixture('empty')

      const result = MigrateDiff.new().parse(['--preview-feature', '--from-url=file:dev.db', '--to-url=file:dev.db'])
      await expect(result).rejects.toThrowErrorMatchingInlineSnapshot(`
              Could not find a schema.prisma file that is required for this command.
              You can either provide it with --schema, set it as \`prisma.schema\` in your package.json or put it into the default location ./prisma/schema.prisma https://pris.ly/d/prisma-schema-location
            `)
    })
  })

  // describe('postgresql', () => {
  //   const connectionString = (
  //     process.env.TEST_POSTGRES_URI_MIGRATE || 'postgres://prisma:prisma@localhost:5432/tests-migrate'
  //   ).replace('tests-migrate', 'tests-migrate-db-execute')
  //   // TODO remove when engine doesn't validate datasource anymore by default from schema
  //   process.env.TEST_POSTGRES_URI_MIGRATE = connectionString
  //   const setupParams: SetupParams = {
  //     connectionString,
  //     dirname: '',
  //   }

  //   beforeAll(async () => {
  //     await setupPostgres(setupParams).catch((e) => {
  //       console.error(e)
  //     })
  //   })

  //   afterAll(async () => {
  //     await tearDownPostgres(setupParams).catch((e) => {
  //       console.error(e)
  //     })
  //   })
  // })

  // describe('mysql', () => {
  //   const connectionString = (
  //     process.env.TEST_MYSQL_URI_MIGRATE || 'mysql://root:root@localhost:3306/tests-migrate'
  //   ).replace('tests-migrate', 'tests-migrate-db-execute')
  //   // TODO remove when engine doesn't validate datasource anymore by default from schema
  //   process.env.TEST_MYSQL_URI_MIGRATE = connectionString
  //   const setupParams: SetupParams = {
  //     connectionString,
  //     dirname: '',
  //   }

  //   beforeAll(async () => {
  //     await setupMysql(setupParams).catch((e) => {
  //       console.error(e)
  //     })
  //   })

  //   afterAll(async () => {
  //     await tearDownMysql(setupParams).catch((e) => {
  //       console.error(e)
  //     })
  //   })
  // })

  // describeIf(!process.env.TEST_SKIP_MSSQL)('sqlserver', () => {
  //   const jdbcConnectionString = (
  //     process.env.TEST_MSSQL_JDBC_URI_MIGRATE ||
  //     'sqlserver://mssql:1433;database=tests-migrate;user=SA;password=Pr1sm4_Pr1sm4;trustServerCertificate=true;'
  //   ).replace('tests-migrate', 'tests-migrate-db-execute')
  //   // TODO remove when engine doesn't validate datasource anymore by default from schema
  //   process.env.TEST_MSSQL_JDBC_URI_MIGRATE = jdbcConnectionString

  //   const setupParams: SetupParams = {
  //     connectionString: process.env.TEST_MSSQL_URI!,
  //     dirname: '',
  //   }

  //   beforeAll(async () => {
  //     await setupMSSQL(setupParams, 'tests-migrate-db-execute').catch((e) => {
  //       console.error(e)
  //     })
  //   })

  //   afterAll(async () => {
  //     await tearDownMSSQL(setupParams, 'tests-migrate-db-execute').catch((e) => {
  //       console.error(e)
  //     })
  //   })
  // })
})
