import fs from 'fs-jetpack'

import { MigrateDeploy } from '../commands/MigrateDeploy'
import type { SetupParams } from '../utils/setupPostgres'
import { setupPostgres, tearDownPostgres } from '../utils/setupPostgres'
import { describeMatrix, postgresOnly, sqliteOnly } from './__helpers__/conditionalTests'
import { createDefaultTestContext } from './__helpers__/context'

const ctx = createDefaultTestContext()

describe('common', () => {
  it('should fail if no schema file', async () => {
    ctx.fixture('empty')
    const result = MigrateDeploy.new().parse([], await ctx.config())
    await expect(result).rejects.toThrowErrorMatchingInlineSnapshot(`
      "Could not find Prisma Schema that is required for this command.
      You can either provide it with \`--schema\` argument,
      set it in your Prisma Config file (e.g., \`prisma.config.ts\`),
      set it as \`prisma.schema\` in your package.json,
      or put it into the default location (\`./prisma/schema.prisma\`, or \`./schema.prisma\`.
      Checked following paths:

      schema.prisma: file not found
      prisma/schema.prisma: file not found

      See also https://pris.ly/d/prisma-schema-location"
    `)
  })
})

describeMatrix(sqliteOnly, 'SQLite', () => {
  it('no unapplied migrations', async () => {
    ctx.fixture('schema-only-sqlite')
    const result = MigrateDeploy.new().parse(['--schema=./prisma/empty.prisma'], await ctx.config())
    await expect(result).resolves.toMatchInlineSnapshot(`"No pending migrations to apply."`)

    expect(ctx.normalizedCapturedStdout()).toMatchInlineSnapshot(`
      "Prisma schema loaded from prisma/empty.prisma
      Datasource "my_db": SQLite database "dev.db" <location placeholder>

      No migration found in prisma/migrations


      "
    `)
    expect(ctx.mocked['console.log'].mock.calls).toMatchInlineSnapshot('[]')
    expect(ctx.mocked['console.error'].mock.calls.join('\n')).toMatchInlineSnapshot('""')
  })

  it('1 unapplied migration', async () => {
    ctx.fixture('existing-db-1-migration')
    fs.remove('dev.db')

    const result = MigrateDeploy.new().parse([], await ctx.config())
    await expect(result).resolves.toMatchInlineSnapshot(`
      "The following migration(s) have been applied:

      migrations/
        └─ 20201231000000_init/
          └─ migration.sql
            
      All migrations have been successfully applied."
    `)

    // Second time should do nothing (already applied)
    const resultBis = MigrateDeploy.new().parse([], await ctx.config())
    await expect(resultBis).resolves.toMatchInlineSnapshot(`"No pending migrations to apply."`)

    expect(ctx.normalizedCapturedStdout()).toMatchInlineSnapshot(`
      "Prisma schema loaded from prisma/schema.prisma
      Datasource "my_db": SQLite database "dev.db" <location placeholder>

      1 migration found in prisma/migrations


      Prisma schema loaded from prisma/schema.prisma
      Datasource "my_db": SQLite database "dev.db" <location placeholder>

      1 migration found in prisma/migrations


      "
    `)
    expect(ctx.mocked['console.log'].mock.calls).toMatchInlineSnapshot('[]')
    expect(ctx.mocked['console.error'].mock.calls.join('\n')).toMatchInlineSnapshot('""')
  })

  it('1 unapplied migration (folder)', async () => {
    ctx.fixture('schema-folder-sqlite-migration-exists')
    fs.remove('dev.db')

    const result = MigrateDeploy.new().parse(['--schema=./prisma'], await ctx.config())
    await expect(result).resolves.toMatchInlineSnapshot(`
      "The following migration(s) have been applied:

      migrations/
        └─ 20201231000000_init/
          └─ migration.sql
            
      All migrations have been successfully applied."
    `)

    // Second time should do nothing (already applied)
    const resultBis = MigrateDeploy.new().parse(['--schema=./prisma'], await ctx.config())
    await expect(resultBis).resolves.toMatchInlineSnapshot(`"No pending migrations to apply."`)

    expect(ctx.normalizedCapturedStdout()).toMatchInlineSnapshot(`
      "Prisma schema loaded from prisma
      Datasource "my_db": SQLite database "dev.db" <location placeholder>

      1 migration found in prisma/migrations


      Prisma schema loaded from prisma
      Datasource "my_db": SQLite database "dev.db" <location placeholder>

      1 migration found in prisma/migrations


      "
    `)
    expect(ctx.mocked['console.log'].mock.calls).toMatchInlineSnapshot('[]')
    expect(ctx.mocked['console.error'].mock.calls.join('\n')).toMatchInlineSnapshot('""')
  })

  it('should throw if database is not empty', async () => {
    ctx.fixture('existing-db-1-migration-conflict')

    const result = MigrateDeploy.new().parse([], await ctx.config())
    await expect(result).rejects.toMatchInlineSnapshot(`
      "P3005

      The database schema is not empty. Read more about how to baseline an existing production database: https://pris.ly/d/migrate-baseline
      "
    `)

    expect(ctx.normalizedCapturedStdout()).toMatchInlineSnapshot(`
      "Prisma schema loaded from prisma/schema.prisma
      Datasource "my_db": SQLite database "dev.db" <location placeholder>

      1 migration found in prisma/migrations

      "
    `)
    expect(ctx.mocked['console.log'].mock.calls).toMatchInlineSnapshot('[]')
    expect(ctx.mocked['console.error'].mock.calls.join('\n')).toMatchInlineSnapshot('""')
  })
})

describeMatrix(postgresOnly, 'postgres', () => {
  const connectionString = process.env.TEST_POSTGRES_URI_MIGRATE!.replace('tests-migrate', 'tests-migrate-deploy')

  const setupParams: SetupParams = {
    connectionString,
    dirname: '',
  }

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

  it('should fail if url is prisma://', async () => {
    ctx.fixture('schema-only-data-proxy')
    const result = MigrateDeploy.new().parse([], await ctx.config())
    await expect(result).rejects.toThrowErrorMatchingInlineSnapshot(`
      "
      Using an Accelerate URL is not supported for this CLI command prisma migrate deploy yet.
      Please use a direct connection to your database via the datasource \`directUrl\` setting.

      More information about this limitation: https://pris.ly/d/accelerate-limitations
      "
    `)
  })

  it('should work if directUrl is set as an env var', async () => {
    ctx.fixture('schema-only-data-proxy')
    const result = MigrateDeploy.new().parse(['--schema', 'with-directUrl-env.prisma'], await ctx.config())
    await expect(result).resolves.toMatchInlineSnapshot(`"No pending migrations to apply."`)
    expect(ctx.normalizedCapturedStderr()).toMatchInlineSnapshot(`
      "Environment variables loaded from .env
      "
    `)
    expect(ctx.normalizedCapturedStdout()).toMatchInlineSnapshot(`
      "Prisma schema loaded from with-directUrl-env.prisma
      Datasource "db": PostgreSQL database "tests-migrate-deploy", schema "public" <location placeholder>

      No migration found in prisma/migrations


      "
    `)
    expect(ctx.mocked['console.error'].mock.calls.join('\n')).toMatchInlineSnapshot(`""`)
  })
})
