import { defaultTestConfig } from '@prisma/config'
import { jestConsoleContext, jestContext } from '@prisma/get-platform'
import fs from 'fs-jetpack'

import { MigrateDeploy } from '../commands/MigrateDeploy'
import { CaptureStdout } from '../utils/captureStdout'
import type { SetupParams } from '../utils/setupPostgres'
import { setupPostgres, tearDownPostgres } from '../utils/setupPostgres'

const ctx = jestContext.new().add(jestConsoleContext()).assemble()
const originalEnv = { ...process.env }

const captureStdout = new CaptureStdout()

beforeEach(() => {
  captureStdout.startCapture()
})

afterEach(() => {
  captureStdout.clearCaptureText()
})

afterAll(() => {
  captureStdout.stopCapture()
})

describe('common', () => {
  it('should fail if no schema file', async () => {
    ctx.fixture('empty')
    const result = MigrateDeploy.new().parse([], defaultTestConfig())
    await expect(result).rejects.toThrowErrorMatchingInlineSnapshot(`
      "Could not find Prisma Schema that is required for this command.
      You can either provide it with \`--schema\` argument, set it as \`prisma.schema\` in your package.json or put it into the default location.
      Checked following paths:

      schema.prisma: file not found
      prisma/schema.prisma: file not found
      prisma/schema: directory not found

      See also https://pris.ly/d/prisma-schema-location"
    `)
  })
})

describe('sqlite', () => {
  it('no unapplied migrations', async () => {
    ctx.fixture('schema-only-sqlite')
    const result = MigrateDeploy.new().parse(['--schema=./prisma/empty.prisma'], defaultTestConfig())
    await expect(result).resolves.toMatchInlineSnapshot(`"No pending migrations to apply."`)

    expect(captureStdout.getCapturedText().join('')).toMatchInlineSnapshot(`
      "Prisma schema loaded from prisma/empty.prisma
      Datasource "my_db": SQLite database "dev.db" at "file:dev.db"

      SQLite database dev.db created at file:dev.db

      No migration found in prisma/migrations


      "
    `)
    expect(ctx.mocked['console.log'].mock.calls).toMatchSnapshot()
    expect(ctx.mocked['console.error'].mock.calls.join('\n')).toMatchSnapshot()
  })

  it('1 unapplied migration', async () => {
    ctx.fixture('existing-db-1-migration')
    fs.remove('prisma/dev.db')

    const result = MigrateDeploy.new().parse([], defaultTestConfig())
    await expect(result).resolves.toMatchInlineSnapshot(`
      "The following migration(s) have been applied:

      migrations/
        └─ 20201231000000_init/
          └─ migration.sql
            
      All migrations have been successfully applied."
    `)

    // Second time should do nothing (already applied)
    const resultBis = MigrateDeploy.new().parse([], defaultTestConfig())
    await expect(resultBis).resolves.toMatchInlineSnapshot(`"No pending migrations to apply."`)

    expect(captureStdout.getCapturedText().join('')).toMatchInlineSnapshot(`
      "Prisma schema loaded from prisma/schema.prisma
      Datasource "my_db": SQLite database "dev.db" at "file:dev.db"

      SQLite database dev.db created at file:dev.db

      1 migration found in prisma/migrations

      Applying migration \`20201231000000_init\`

      Prisma schema loaded from prisma/schema.prisma
      Datasource "my_db": SQLite database "dev.db" at "file:dev.db"

      1 migration found in prisma/migrations


      "
    `)
    expect(ctx.mocked['console.log'].mock.calls).toMatchSnapshot()
    expect(ctx.mocked['console.error'].mock.calls.join('\n')).toMatchSnapshot()
  })

  it('1 unapplied migration (folder)', async () => {
    ctx.fixture('schema-folder-sqlite-migration-exists')
    fs.remove('prisma/dev.db')

    const result = MigrateDeploy.new().parse([], defaultTestConfig())
    await expect(result).resolves.toMatchInlineSnapshot(`
      "The following migration(s) have been applied:

      migrations/
        └─ 20201231000000_init/
          └─ migration.sql
            
      All migrations have been successfully applied."
    `)

    // Second time should do nothing (already applied)
    const resultBis = MigrateDeploy.new().parse([], defaultTestConfig())
    await expect(resultBis).resolves.toMatchInlineSnapshot(`"No pending migrations to apply."`)

    expect(captureStdout.getCapturedText().join('')).toMatchInlineSnapshot(`
      "Prisma schema loaded from prisma/schema
      Datasource "my_db": SQLite database "dev.db" at "file:dev.db"

      SQLite database dev.db created at file:dev.db

      1 migration found in prisma/migrations

      Applying migration \`20201231000000_init\`

      Prisma schema loaded from prisma/schema
      Datasource "my_db": SQLite database "dev.db" at "file:dev.db"

      1 migration found in prisma/migrations


      "
    `)
    expect(ctx.mocked['console.log'].mock.calls).toMatchSnapshot()
    expect(ctx.mocked['console.error'].mock.calls.join('\n')).toMatchSnapshot()
  })

  it('should throw if database is not empty', async () => {
    ctx.fixture('existing-db-1-migration-conflict')

    const result = MigrateDeploy.new().parse([], defaultTestConfig())
    await expect(result).rejects.toMatchInlineSnapshot(`
      "P3005

      The database schema is not empty. Read more about how to baseline an existing production database: https://pris.ly/d/migrate-baseline
      "
    `)

    expect(captureStdout.getCapturedText().join('')).toMatchInlineSnapshot(`
      "Prisma schema loaded from prisma/schema.prisma
      Datasource "my_db": SQLite database "dev.db" at "file:dev.db"

      1 migration found in prisma/migrations

      "
    `)
    expect(ctx.mocked['console.log'].mock.calls).toMatchSnapshot()
    expect(ctx.mocked['console.error'].mock.calls.join('\n')).toMatchSnapshot()
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
    const result = MigrateDeploy.new().parse([], defaultTestConfig())
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
    const result = MigrateDeploy.new().parse(['--schema', 'with-directUrl-env.prisma'], defaultTestConfig())
    await expect(result).resolves.toMatchInlineSnapshot(`"No pending migrations to apply."`)
    expect(captureStdout.getCapturedText().join('')).toMatchInlineSnapshot(`
      "Environment variables loaded from .env
      Prisma schema loaded from with-directUrl-env.prisma
      Datasource "db": PostgreSQL database "tests-migrate-deploy", schema "public" at "localhost:5432"

      No migration found in prisma/migrations


      "
    `)
    expect(ctx.mocked['console.error'].mock.calls.join('\n')).toMatchInlineSnapshot(`""`)
  })
})
