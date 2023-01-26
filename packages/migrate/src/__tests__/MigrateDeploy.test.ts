import { jestConsoleContext, jestContext } from '@prisma/internals'
import fs from 'fs-jetpack'

import { MigrateDeploy } from '../commands/MigrateDeploy'
import type { SetupParams } from '../utils/setupPostgres'
import { setupPostgres, tearDownPostgres } from '../utils/setupPostgres'

const ctx = jestContext.new().add(jestConsoleContext()).assemble()
const originalEnv = { ...process.env }

describe('common', () => {
  it('should fail if no schema file', async () => {
    ctx.fixture('empty')
    const result = MigrateDeploy.new().parse([])
    await expect(result).rejects.toThrowErrorMatchingInlineSnapshot(`
            Could not find a schema.prisma file that is required for this command.
            You can either provide it with --schema, set it as \`prisma.schema\` in your package.json or put it into the default location ./prisma/schema.prisma https://pris.ly/d/prisma-schema-location
          `)
  })
  it('should fail if experimental flag', async () => {
    ctx.fixture('empty')
    const result = MigrateDeploy.new().parse(['--experimental'])
    await expect(result).rejects.toThrowErrorMatchingInlineSnapshot(`
            Prisma Migrate was Experimental and is now Generally Available.
            WARNING this new version has some breaking changes to use it it's recommended to read the documentation first and remove the --experimental flag.
          `)
  })
  it('should fail if early access flag', async () => {
    ctx.fixture('empty')
    const result = MigrateDeploy.new().parse(['--early-access-feature'])
    await expect(result).rejects.toThrowErrorMatchingInlineSnapshot(`
            Prisma Migrate was in Early Access and is now Generally Available.
            Remove the --early-access-feature flag.
          `)
  })
})

describe('sqlite', () => {
  it('no unapplied migrations', async () => {
    ctx.fixture('schema-only-sqlite')
    const result = MigrateDeploy.new().parse(['--schema=./prisma/empty.prisma'])
    await expect(result).resolves.toMatchInlineSnapshot(`No pending migrations to apply.`)

    expect(ctx.mocked['console.info'].mock.calls.join('\n')).toMatchInlineSnapshot(`
      Prisma schema loaded from prisma/empty.prisma
      Datasource "my_db": SQLite database "dev.db" at "file:dev.db"

      SQLite database dev.db created at file:dev.db

      No migration found in prisma/migrations


    `)
    expect(ctx.mocked['console.log'].mock.calls).toMatchSnapshot()
    expect(ctx.mocked['console.error'].mock.calls).toMatchSnapshot()
  })

  it('1 unapplied migration', async () => {
    ctx.fixture('existing-db-1-migration')
    fs.remove('prisma/dev.db')

    const result = MigrateDeploy.new().parse([])
    await expect(result).resolves.toMatchInlineSnapshot(`
            The following migration have been applied:

            migrations/
              └─ 20201231000000_init/
                └─ migration.sql
                  
            All migrations have been successfully applied.
          `)

    // Second time should do nothing (already applied)
    const resultBis = MigrateDeploy.new().parse([])
    await expect(resultBis).resolves.toMatchInlineSnapshot(`No pending migrations to apply.`)

    expect(ctx.mocked['console.info'].mock.calls.join('\n')).toMatchInlineSnapshot(`
      Prisma schema loaded from prisma/schema.prisma
      Datasource "my_db": SQLite database "dev.db" at "file:dev.db"

      SQLite database dev.db created at file:dev.db

      1 migration found in prisma/migrations

      Applying migration \`20201231000000_init\`

      Prisma schema loaded from prisma/schema.prisma
      Datasource "my_db": SQLite database "dev.db" at "file:dev.db"

      1 migration found in prisma/migrations


    `)
    expect(ctx.mocked['console.log'].mock.calls).toMatchSnapshot()
    expect(ctx.mocked['console.error'].mock.calls).toMatchSnapshot()
  })

  it('should throw if database is not empty', async () => {
    ctx.fixture('existing-db-1-migration-conflict')

    const result = MigrateDeploy.new().parse([])
    await expect(result).rejects.toMatchInlineSnapshot(`
            P3005

            The database schema is not empty. Read more about how to baseline an existing production database: https://pris.ly/d/migrate-baseline

          `)

    expect(ctx.mocked['console.info'].mock.calls.join('\n')).toMatchInlineSnapshot(`
      Prisma schema loaded from prisma/schema.prisma
      Datasource "my_db": SQLite database "dev.db" at "file:dev.db"

      1 migration found in prisma/migrations

    `)
    expect(ctx.mocked['console.log'].mock.calls).toMatchSnapshot()
    expect(ctx.mocked['console.error'].mock.calls).toMatchSnapshot()
  })
})

describe('postgresql', () => {
  const connectionString = process.env.TEST_POSTGRES_URI_MIGRATE!.replace('tests-migrate', 'tests-migrate-deploy')

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

  it('should fail if url is prisma://', async () => {
    ctx.fixture('schema-only-data-proxy')
    const result = MigrateDeploy.new().parse([])
    await expect(result).rejects.toThrowErrorMatchingInlineSnapshot(`

    Using the Data Proxy (connection URL starting with protocol prisma://) is not supported for this CLI command prisma migrate deploy yet. Please use a direct connection to your database via the datasource 'directUrl' setting.

    More information about Data Proxy: https://pris.ly/d/data-proxy-cli

  `)
  })

  it('should work if directUrl is set as an env var', async () => {
    ctx.fixture('schema-only-data-proxy')
    const result = MigrateDeploy.new().parse(['--schema', 'with-directUrl-env.prisma'])
    await expect(result).resolves.toMatchInlineSnapshot(`No pending migrations to apply.`)
    expect(ctx.mocked['console.info'].mock.calls.join('\n')).toMatchInlineSnapshot(`
      Prisma schema loaded from with-directUrl-env.prisma
      Datasource "db": PostgreSQL database "tests-migrate-deploy", schema "public" at "localhost:5432"

      No migration found in prisma/migrations


    `)
    expect(ctx.mocked['console.error'].mock.calls.join('\n')).toMatchInlineSnapshot(``)
  })
})
