import { defaultTestConfig } from '@prisma/config'
import { jestConsoleContext, jestContext } from '@prisma/get-platform'

import { MigrateResolve } from '../commands/MigrateResolve'
import { CaptureStdout } from '../utils/captureStdout'

const ctx = jestContext.new().add(jestConsoleContext()).assemble()

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
    const result = MigrateResolve.new().parse([], defaultTestConfig())
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
  it('should fail if no --applied or --rolled-back', async () => {
    ctx.fixture('schema-only-sqlite')
    const result = MigrateResolve.new().parse([], defaultTestConfig())
    await expect(result).rejects.toThrowErrorMatchingInlineSnapshot(`
      "--applied or --rolled-back must be part of the command like:
      prisma migrate resolve --applied 20201231000000_example
      prisma migrate resolve --rolled-back 20201231000000_example"
    `)
  })
  it('should fail if both --applied or --rolled-back', async () => {
    ctx.fixture('schema-only-sqlite')
    const result = MigrateResolve.new().parse(
      ['--applied=something_applied', '--rolled-back=something_rolledback'],
      defaultTestConfig(),
    )
    await expect(result).rejects.toThrowErrorMatchingInlineSnapshot(
      `"Pass either --applied or --rolled-back, not both."`,
    )
  })
})

describe('sqlite', () => {
  it('should fail if no sqlite db - empty schema', async () => {
    ctx.fixture('schema-only-sqlite')
    const result = MigrateResolve.new().parse(
      ['--schema=./prisma/empty.prisma', '--applied=something_applied'],
      defaultTestConfig(),
    )
    await expect(result).rejects.toMatchInlineSnapshot(`"P1003: Database \`dev.db\` does not exist at \`dev.db\`."`)

    expect(captureStdout.getCapturedText().join('')).toMatchInlineSnapshot(`
      "Prisma schema loaded from prisma/empty.prisma
      Datasource "my_db": SQLite database "dev.db" at "file:dev.db"
      "
    `)
  })

  //
  // --applied
  //

  it("--applied should fail if migration doesn't exist", async () => {
    ctx.fixture('existing-db-1-failed-migration')
    const result = MigrateResolve.new().parse(['--applied=does_not_exist'], defaultTestConfig())
    await expect(result).rejects.toThrowErrorMatchingInlineSnapshot(`
      "P3017

      The migration does_not_exist could not be found. Please make sure that the migration exists, and that you included the whole name of the directory. (example: "20201231000000_initial_migration")
      "
    `)
  })

  it('--applied should fail if migration is already applied', async () => {
    ctx.fixture('existing-db-1-migration')
    const result = MigrateResolve.new().parse(['--applied=20201014154943_init'], defaultTestConfig())
    await expect(result).rejects.toThrowErrorMatchingInlineSnapshot(`
      "P3008

      The migration \`20201231000000_init\` is already recorded as applied in the database.
      "
    `)
  })

  it('--applied should fail if migration is not in a failed state', async () => {
    ctx.fixture('existing-db-1-migration')
    const result = MigrateResolve.new().parse(['--applied', '20201014154943_init'], defaultTestConfig())
    await expect(result).rejects.toThrowErrorMatchingInlineSnapshot(`
      "P3008

      The migration \`20201231000000_init\` is already recorded as applied in the database.
      "
    `)
  })

  it('--applied should work on a failed migration', async () => {
    ctx.fixture('existing-db-1-failed-migration')
    const result = MigrateResolve.new().parse(['--applied', '20201106130852_failed'], defaultTestConfig())
    await expect(result).resolves.toMatchInlineSnapshot(`""`)
    expect(captureStdout.getCapturedText().join('')).toMatchInlineSnapshot(`
      "Prisma schema loaded from prisma/schema.prisma
      Datasource "my_db": SQLite database "dev.db" at "file:dev.db"

      Migration 20201231000000_failed marked as applied.
      "
    `)
  })

  it('--applied should work on a failed migration (schema folder)', async () => {
    ctx.fixture('schema-folder-sqlite-migration-failed')
    const result = MigrateResolve.new().parse(['--applied', '20240527130802_init'], defaultTestConfig())
    await expect(result).resolves.toMatchInlineSnapshot(`""`)
    expect(captureStdout.getCapturedText().join('')).toMatchInlineSnapshot(`
      "Prisma schema loaded from prisma/schema
      Datasource "my_db": SQLite database "dev.db" at "file:../dev.db"

      Migration 20201231000000_init marked as applied.
      "
    `)
  })

  //
  // --rolled-back
  //

  it("--rolled-back should fail if migration doesn't exist", async () => {
    ctx.fixture('existing-db-1-failed-migration')
    const result = MigrateResolve.new().parse(['--rolled-back=does_not_exist'], defaultTestConfig())
    await expect(result).rejects.toThrowErrorMatchingInlineSnapshot(`
      "P3011

      Migration \`does_not_exist\` cannot be rolled back because it was never applied to the database. Hint: did you pass in the whole migration name? (example: "20201231000000_initial_migration")
      "
    `)
  })

  it('--rolled-back should fail if migration is not in a failed state', async () => {
    ctx.fixture('existing-db-1-migration')
    const result = MigrateResolve.new().parse(['--rolled-back', '20201014154943_init'], defaultTestConfig())
    await expect(result).rejects.toThrowErrorMatchingInlineSnapshot(`
      "P3012

      Migration \`20201231000000_init\` cannot be rolled back because it is not in a failed state.
      "
    `)
  })

  it('--rolled-back should work on a failed migration', async () => {
    ctx.fixture('existing-db-1-failed-migration')
    const result = MigrateResolve.new().parse(['--rolled-back', '20201106130852_failed'], defaultTestConfig())
    await expect(result).resolves.toMatchInlineSnapshot(`""`)
    expect(captureStdout.getCapturedText().join('')).toMatchInlineSnapshot(`
      "Prisma schema loaded from prisma/schema.prisma
      Datasource "my_db": SQLite database "dev.db" at "file:dev.db"

      Migration 20201231000000_failed marked as rolled back.
      "
    `)
  })

  it('--rolled-back works if migration is already rolled back', async () => {
    ctx.fixture('existing-db-1-failed-migration')
    const result = MigrateResolve.new().parse(['--rolled-back', '20201106130852_failed'], defaultTestConfig())
    await expect(result).resolves.toMatchInlineSnapshot(`""`)

    // Try again
    const result2 = MigrateResolve.new().parse(['--rolled-back', '20201106130852_failed'], defaultTestConfig())
    await expect(result2).resolves.toMatchInlineSnapshot(`""`)

    expect(captureStdout.getCapturedText().join('')).toMatchInlineSnapshot(`
      "Prisma schema loaded from prisma/schema.prisma
      Datasource "my_db": SQLite database "dev.db" at "file:dev.db"

      Migration 20201231000000_failed marked as rolled back.
      Prisma schema loaded from prisma/schema.prisma
      Datasource "my_db": SQLite database "dev.db" at "file:dev.db"

      Migration 20201231000000_failed marked as rolled back.
      "
    `)
  })
})

describe('postgresql', () => {
  it('should fail if no db - invalid url', async () => {
    ctx.fixture('schema-only-postgresql')
    jest.setTimeout(10_000)

    const result = MigrateResolve.new().parse(
      ['--schema=./prisma/invalid-url.prisma', '--applied=something_applied'],
      defaultTestConfig(),
    )
    await expect(result).rejects.toMatchInlineSnapshot(`
      "P1001: Can't reach database server at \`doesnotexist:5432\`

      Please make sure your database server is running at \`doesnotexist:5432\`."
    `)

    expect(captureStdout.getCapturedText().join('')).toMatchInlineSnapshot(`
      "Environment variables loaded from prisma/.env
      Prisma schema loaded from prisma/invalid-url.prisma
      Datasource "my_db": PostgreSQL database "mydb", schema "public" at "doesnotexist:5432"
      "
    `)
  })
})

const describeIf = (condition: boolean) => (condition ? describe : describe.skip)

describeIf(!process.env.TEST_SKIP_COCKROACHDB)('cockroachdb', () => {
  it('should fail if no db - invalid url', async () => {
    ctx.fixture('schema-only-cockroachdb')

    const result = MigrateResolve.new().parse(
      ['--schema=./prisma/invalid-url.prisma', '--applied=something_applied'],
      defaultTestConfig(),
    )
    await expect(result).rejects.toMatchInlineSnapshot(`
      "P1001: Can't reach database server at \`something.cockroachlabs.cloud:26257\`

      Please make sure your database server is running at \`something.cockroachlabs.cloud:26257\`."
    `)

    expect(captureStdout.getCapturedText().join('')).toMatchInlineSnapshot(`
      "Environment variables loaded from prisma/.env
      Prisma schema loaded from prisma/invalid-url.prisma
      Datasource "db": CockroachDB database "clustername.defaultdb", schema "public" at "something.cockroachlabs.cloud:26257"
      "
    `)
  }, 10_000)
})
