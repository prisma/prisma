// describeIf is making eslint unhappy about the test names

import { defaultTestConfig } from '@prisma/config'
import { jestConsoleContext, jestContext } from '@prisma/get-platform'
import path from 'node:path'
import prompt from 'prompts'

import { DbPush } from '../commands/DbPush'
import { CaptureStdout } from '../utils/captureStdout'
import { setupMongo, type SetupParams, tearDownMongo } from '../utils/setupMongo'
import { setupPostgres, tearDownPostgres } from '../utils/setupPostgres'

process.env.PRISMA_MIGRATE_SKIP_GENERATE = '1'

const describeIf = (condition: boolean) => (condition ? describe : describe.skip)
const ctx = jestContext.new().add(jestConsoleContext()).assemble()

function removeRocketEmoji(str: string) {
  return str.replace('🚀  ', '')
}

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

const originalEnv = { ...process.env }

describe('push', () => {
  it('should fail if no schema file', async () => {
    ctx.fixture('empty')

    const result = DbPush.new().parse([], defaultTestConfig())
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

  it('should fail if nativeTypes VarChar on sqlite', async () => {
    ctx.fixture('nativeTypes-sqlite')
    const result = DbPush.new().parse([], defaultTestConfig())
    await expect(result).rejects.toThrowErrorMatchingInlineSnapshot(`
      "P1012

      error: Native type VarChar is not supported for sqlite connector.
        -->  prisma/schema.prisma:12
         | 
      11 |   id   Int    @id
      12 |   name String @db.VarChar(100)
         | 

      "
    `)
  })

  it('already in sync', async () => {
    ctx.fixture('reset')
    const result = DbPush.new().parse([], defaultTestConfig())
    await expect(result).resolves.toMatchInlineSnapshot(`""`)
    expect(removeRocketEmoji(captureStdout.getCapturedText().join(''))).toMatchInlineSnapshot(`
      "Prisma schema loaded from prisma/schema.prisma
      Datasource "my_db": SQLite database "dev.db" at "file:dev.db"

      Your database is now in sync with your Prisma schema. Done in XXXms
      "
    `)
  })

  it('missing SQLite db should be created next to the schema.prisma file', async () => {
    ctx.fixture('reset')
    ctx.fs.remove('prisma/dev.db')
    const schemaPath = 'prisma/schema.prisma'

    const result = DbPush.new().parse([], defaultTestConfig())
    await expect(result).resolves.toMatchInlineSnapshot(`""`)
    expect(removeRocketEmoji(captureStdout.getCapturedText().join(''))).toMatchInlineSnapshot(`
      "Prisma schema loaded from prisma/schema.prisma
      Datasource "my_db": SQLite database "dev.db" at "file:dev.db"

      SQLite database dev.db created at file:dev.db

      Your database is now in sync with your Prisma schema. Done in XXXms
      "
    `)
    expect(ctx.fs.inspect(schemaPath)?.size).toBeGreaterThan(0)
    expect(ctx.fs.inspect(path.join(path.dirname(schemaPath), 'dev.db'))?.size).toBeGreaterThan(0)
    expect(ctx.fs.inspect('dev.db')?.size).toBeUndefined()
  })

  it('missing SQLite db should be created next to the schema folder', async () => {
    ctx.fixture('schema-folder-sqlite')
    ctx.fs.remove('prisma/dev.db')
    const schemaPath = 'prisma/schema'

    const result = DbPush.new().parse([], defaultTestConfig())
    await expect(result).resolves.toMatchInlineSnapshot(`""`)
    expect(removeRocketEmoji(captureStdout.getCapturedText().join(''))).toMatchInlineSnapshot(`
      "Prisma schema loaded from prisma/schema
      Datasource "my_db": SQLite database "dev.db" at "file:../dev.db"

      SQLite database dev.db created at file:../dev.db

      Your database is now in sync with your Prisma schema. Done in XXXms
      "
    `)
    expect(ctx.fs.inspect(path.join(path.dirname(schemaPath), 'dev.db'))?.size).toBeGreaterThan(0)
    expect(ctx.fs.inspect('dev.db')?.size).toBeUndefined()
  })

  it('missing SQLite db should be created next to the --schema path', async () => {
    ctx.fixture('reset')
    ctx.fs.remove('prisma/dev.db')

    const oldSchemaPath = 'prisma/schema.prisma'
    const newSchemaPath = 'something/schema.prisma'
    ctx.fs.move(oldSchemaPath, newSchemaPath)

    const result = DbPush.new().parse(['--schema', newSchemaPath], defaultTestConfig())
    await expect(result).resolves.toMatchInlineSnapshot(`""`)
    expect(removeRocketEmoji(captureStdout.getCapturedText().join(''))).toMatchInlineSnapshot(`
      "Prisma schema loaded from something/schema.prisma
      Datasource "my_db": SQLite database "dev.db" at "file:dev.db"

      SQLite database dev.db created at file:dev.db

      Your database is now in sync with your Prisma schema. Done in XXXms
      "
    `)
    expect(ctx.fs.inspect(oldSchemaPath)?.size).toBeUndefined()
    expect(ctx.fs.inspect(newSchemaPath)?.size).toBeGreaterThan(0)
    expect(ctx.fs.inspect(path.join(path.dirname(oldSchemaPath), 'dev.db'))?.size).toBeUndefined()
    expect(ctx.fs.inspect(path.join(path.dirname(newSchemaPath), 'dev.db'))?.size).toBeGreaterThan(0)
    expect(ctx.fs.inspect('dev.db')?.size).toBeUndefined()
  })

  it('should ask for --accept-data-loss if not provided in CI', async () => {
    ctx.fixture('existing-db-warnings')
    process.env.GITHUB_ACTIONS = '1'

    const result = DbPush.new().parse([], defaultTestConfig())
    await expect(result).rejects.toMatchInlineSnapshot(
      `"Use the --accept-data-loss flag to ignore the data loss warnings like prisma db push --accept-data-loss"`,
    )
  })

  it('dataloss warnings accepted (prompt)', async () => {
    ctx.fixture('existing-db-warnings')

    prompt.inject(['y'])

    const result = DbPush.new().parse([], defaultTestConfig())
    await expect(result).resolves.toMatchInlineSnapshot(`""`)
    expect(removeRocketEmoji(captureStdout.getCapturedText().join(''))).toMatchInlineSnapshot(`
      "Prisma schema loaded from prisma/schema.prisma
      Datasource "my_db": SQLite database "dev.db" at "file:dev.db"

      ⚠️  There might be data loss when applying the changes:

        • You are about to drop the \`Blog\` table, which is not empty (1 rows).




      Your database is now in sync with your Prisma schema. Done in XXXms
      "
    `)
  })

  it('dataloss warnings cancelled (prompt)', async () => {
    ctx.fixture('existing-db-warnings')
    const mockExit = jest.spyOn(process, 'exit').mockImplementation((number) => {
      throw new Error(`process.exit: ${number}`)
    })

    prompt.inject([new Error()]) // simulate user cancellation

    const result = DbPush.new().parse([], defaultTestConfig())
    await expect(result).rejects.toMatchInlineSnapshot(`"process.exit: 130"`)
    expect(removeRocketEmoji(captureStdout.getCapturedText().join(''))).toMatchInlineSnapshot(`
      "Prisma schema loaded from prisma/schema.prisma
      Datasource "my_db": SQLite database "dev.db" at "file:dev.db"

      ⚠️  There might be data loss when applying the changes:

        • You are about to drop the \`Blog\` table, which is not empty (1 rows).



      Push cancelled.
      "
    `)

    expect(mockExit).toHaveBeenCalledWith(130)
  })

  it('--accept-data-loss flag', async () => {
    ctx.fixture('existing-db-warnings')
    const result = DbPush.new().parse(['--accept-data-loss'], defaultTestConfig())
    await expect(result).resolves.toMatchInlineSnapshot(`""`)
    expect(removeRocketEmoji(captureStdout.getCapturedText().join(''))).toMatchInlineSnapshot(`
      "Prisma schema loaded from prisma/schema.prisma
      Datasource "my_db": SQLite database "dev.db" at "file:dev.db"

      ⚠️  There might be data loss when applying the changes:

        • You are about to drop the \`Blog\` table, which is not empty (1 rows).



      Your database is now in sync with your Prisma schema. Done in XXXms
      "
    `)
  })

  it('unexecutable - drop allowed (--force-reset)', async () => {
    ctx.fixture('existing-db-1-unexecutable-schema-change')

    const result = DbPush.new().parse(['--force-reset'], defaultTestConfig())

    const sqliteDbSizeBefore = ctx.fs.inspect('prisma/dev.db')!.size

    await expect(result).resolves.toMatchInlineSnapshot(`""`)

    const sqliteDbSizeAfter = ctx.fs.inspect('prisma/dev.db')!.size

    expect(sqliteDbSizeBefore).toBeGreaterThan(10_000)
    expect(sqliteDbSizeAfter).toBeGreaterThan(10_000)
    expect(sqliteDbSizeAfter).toBeLessThan(sqliteDbSizeBefore)

    expect(removeRocketEmoji(captureStdout.getCapturedText().join(''))).toMatchInlineSnapshot(`
      "Prisma schema loaded from prisma/schema.prisma
      Datasource "my_db": SQLite database "dev.db" at "file:dev.db"

      The SQLite database "dev.db" at "file:dev.db" was successfully reset.

      Your database is now in sync with your Prisma schema. Done in XXXms
      "
    `)
  })

  it('unexecutable - drop refused', async () => {
    ctx.fixture('existing-db-warnings')
    const mockExit = jest.spyOn(process, 'exit').mockImplementation((number) => {
      throw new Error(`process.exit: ${number}`)
    })

    prompt.inject([new Error()]) // simulate user cancellation

    const result = DbPush.new().parse([], defaultTestConfig())
    await expect(result).rejects.toMatchInlineSnapshot(`"process.exit: 130"`)
    expect(removeRocketEmoji(captureStdout.getCapturedText().join(''))).toMatchInlineSnapshot(`
      "Prisma schema loaded from prisma/schema.prisma
      Datasource "my_db": SQLite database "dev.db" at "file:dev.db"

      ⚠️  There might be data loss when applying the changes:

        • You are about to drop the \`Blog\` table, which is not empty (1 rows).



      Push cancelled.
      "
    `)

    expect(mockExit).toHaveBeenCalledWith(130)
  })

  it('unexecutable - should ask for --force-reset in CI', async () => {
    ctx.fixture('existing-db-1-unexecutable-schema-change')
    process.env.GITHUB_ACTIONS = '1'

    const result = DbPush.new().parse([], defaultTestConfig())
    await expect(result).rejects.toMatchInlineSnapshot(`
      "
      ⚠️ We found changes that cannot be executed:

        • Made the column \`fullname\` on table \`Blog\` required, but there are 1 existing NULL values.

      You may use the --force-reset flag to drop the database before push like prisma db push --force-reset
      All data will be lost.
            "
    `)
  })
})

describe('postgresql', () => {
  const connectionString = process.env.TEST_POSTGRES_URI_MIGRATE!.replace('tests-migrate', 'tests-migrate-db-push')

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

  it('--force-reset should succeed and display a log', async () => {
    ctx.fixture('schema-only-postgresql')

    prompt.inject(['y'])

    const result = DbPush.new().parse(['--force-reset'], defaultTestConfig())
    await expect(result).resolves.toMatchInlineSnapshot(`""`)
    expect(removeRocketEmoji(captureStdout.getCapturedText().join(''))).toMatchInlineSnapshot(`
      "Environment variables loaded from prisma/.env
      Prisma schema loaded from prisma/schema.prisma
      Datasource "my_db": PostgreSQL database "tests-migrate-db-push", schema "public" at "localhost:5432"

      The PostgreSQL database "tests-migrate-db-push" schema "public" at "localhost:5432" was successfully reset.

      Your database is now in sync with your Prisma schema. Done in XXXms
      "
    `)
  })

  it('should work if url is prisma:// and directUrl defined', async () => {
    ctx.fixture('schema-only-data-proxy')

    prompt.inject(['n'])

    const result = DbPush.new().parse(['--schema', 'with-directUrl-env.prisma'], defaultTestConfig())
    await expect(result).resolves.toMatchInlineSnapshot(`""`)
    expect(removeRocketEmoji(captureStdout.getCapturedText().join(''))).toMatchInlineSnapshot(`
      "Environment variables loaded from .env
      Prisma schema loaded from with-directUrl-env.prisma
      Datasource "db": PostgreSQL database "tests-migrate-db-push", schema "public" at "localhost:5432"

      ⚠️  There might be data loss when applying the changes:

        • You are about to drop the \`User\` table, which is not empty (1 rows).




      Your database is now in sync with your Prisma schema. Done in XXXms
      "
    `)
  })
})

describe('postgresql-multischema', () => {
  const connectionString = process.env.TEST_POSTGRES_URI_MIGRATE!.replace(
    'tests-migrate',
    'tests-migrate-db-push-multischema',
  )

  const setupParams: SetupParams = {
    connectionString,
    // Note: at this location there is a setup.sql file
    // which will be executed a SQL file so the database is not empty
    dirname: path.join(__dirname, '..', '__tests__', 'fixtures', 'introspection', 'postgresql-multischema'),
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

  it('multiSchema: --force-reset should succeed and display a log', async () => {
    ctx.fixture('introspection/postgresql-multischema')

    prompt.inject(['y'])

    const result = DbPush.new().parse(['--force-reset'], defaultTestConfig())
    await expect(result).resolves.toMatchInlineSnapshot(`""`)
    expect(removeRocketEmoji(captureStdout.getCapturedText().join(''))).toMatchInlineSnapshot(`
      "Prisma schema loaded from schema.prisma
      Datasource "db": PostgreSQL database "tests-migrate-db-push-multischema", schemas "base, transactional" at "localhost:5432"

      The PostgreSQL database "tests-migrate-db-push-multischema" schemas "base, transactional" at "localhost:5432" were successfully reset.

      Your database is now in sync with your Prisma schema. Done in XXXms
      "
    `)
  })
})

describeIf(!process.env.TEST_SKIP_MONGODB)('push existing-db with mongodb', () => {
  if (!process.env.TEST_SKIP_MONGODB && !process.env.TEST_MONGO_URI_MIGRATE_EXISTING_DB) {
    throw new Error('You must set a value for process.env.TEST_MONGO_URI_MIGRATE_EXISTING_DB')
  }
  const setupParams: SetupParams = {
    connectionString: process.env.TEST_MONGO_URI_MIGRATE_EXISTING_DB!,
    dirname: path.join(__dirname, '..', '__tests__', 'fixtures', 'existing-db-warnings-mongodb'),
  }

  beforeAll(async () => {
    await tearDownMongo(setupParams).catch((e) => {
      console.error(e)
    })
  })

  beforeEach(async () => {
    await setupMongo(setupParams).catch((e) => {
      console.error(e)
    })
  })

  afterEach(async () => {
    await tearDownMongo(setupParams).catch((e) => {
      console.error(e)
    })
  })

  it('--force-reset should succeed and print a log', async () => {
    ctx.fixture('existing-db-warnings-mongodb')

    prompt.inject(['y'])

    const result = DbPush.new().parse(['--force-reset'], defaultTestConfig())
    await expect(result).resolves.toMatchInlineSnapshot(`""`)
    expect(removeRocketEmoji(captureStdout.getCapturedText().join(''))).toMatchInlineSnapshot(`
      "Prisma schema loaded from prisma/schema.prisma
      Datasource "my_db": MongoDB database "tests-migrate-existing-db" at "localhost:27017"

      The MongoDB database "tests-migrate-existing-db" at "localhost:27017" was successfully reset.
      Applying the following changes:

      [+] Collection \`Post\`


      Your database indexes are now in sync with your Prisma schema. Done in XXXms
      "
    `)
  })

  it('dataloss warnings accepted (prompt)', async () => {
    ctx.fixture('existing-db-warnings-mongodb')

    prompt.inject(['y'])

    const result = DbPush.new().parse([], defaultTestConfig())
    await expect(result).resolves.toMatchInlineSnapshot(`""`)
    expect(removeRocketEmoji(captureStdout.getCapturedText().join(''))).toMatchInlineSnapshot(`
      "Prisma schema loaded from prisma/schema.prisma
      Datasource "my_db": MongoDB database "tests-migrate-existing-db" at "localhost:27017"
      Applying the following changes:

      [+] Collection \`Post\`


      Your database indexes are now in sync with your Prisma schema. Done in XXXms
      "
    `)
  })

  it('dataloss warnings cancelled (prompt)', async () => {
    ctx.fixture('existing-db-warnings-mongodb')
    const mockExit = jest.spyOn(process, 'exit').mockImplementation((number) => {
      throw new Error(`process.exit: ${number}`)
    })

    prompt.inject([new Error()]) // simulate user cancellation

    const result = DbPush.new().parse([], defaultTestConfig())
    await expect(result).resolves.toMatchInlineSnapshot(`""`)
    expect(removeRocketEmoji(captureStdout.getCapturedText().join(''))).toMatchInlineSnapshot(`
      "Prisma schema loaded from prisma/schema.prisma
      Datasource "my_db": MongoDB database "tests-migrate-existing-db" at "localhost:27017"
      Applying the following changes:

      [+] Collection \`Post\`


      Your database indexes are now in sync with your Prisma schema. Done in XXXms
      "
    `)

    expect(mockExit).toHaveBeenCalledWith(130)
  })

  it('--accept-data-loss flag', async () => {
    ctx.fixture('existing-db-warnings-mongodb')
    const result = DbPush.new().parse(['--accept-data-loss'], defaultTestConfig())
    await expect(result).resolves.toMatchInlineSnapshot(`""`)
    expect(removeRocketEmoji(captureStdout.getCapturedText().join(''))).toMatchInlineSnapshot(`
      "Prisma schema loaded from prisma/schema.prisma
      Datasource "my_db": MongoDB database "tests-migrate-existing-db" at "localhost:27017"
      Applying the following changes:

      [+] Collection \`Post\`


      Your database indexes are now in sync with your Prisma schema. Done in XXXms
      "
    `)
  })
})
