import { jestConsoleContext, jestContext } from '@prisma/internals'
import path from 'path'
import prompt from 'prompts'

import { DbPush } from '../commands/DbPush'
import { setupMongo, SetupParams, tearDownMongo } from '../utils/setupMongo'

process.env.PRISMA_MIGRATE_SKIP_GENERATE = '1'

// TODO: Windows: a lot of snapshot tests here fail on Windows because of emoji.
const describeIf = (condition: boolean) => (condition ? describe : describe.skip)

const ctx = jestContext.new().add(jestConsoleContext()).assemble()

describeIf(process.platform !== 'win32')('push', () => {
  it('--preview-feature flag is not required anymore', async () => {
    ctx.fixture('empty')

    const result = DbPush.new().parse(['--preview-feature'])
    await expect(result).rejects.toThrowErrorMatchingInlineSnapshot(`
            Could not find a schema.prisma file that is required for this command.
            You can either provide it with --schema, set it as \`prisma.schema\` in your package.json or put it into the default location ./prisma/schema.prisma https://pris.ly/d/prisma-schema-location
          `)
    expect(ctx.mocked['console.warn'].mock.calls.join('\n')).toMatchInlineSnapshot(`
      prisma:warn Prisma "db push" was in Preview and is now Generally Available.
      You can now remove the --preview-feature flag.
    `)
  })

  it('should fail if no schema file', async () => {
    ctx.fixture('empty')

    const result = DbPush.new().parse([])
    await expect(result).rejects.toThrowErrorMatchingInlineSnapshot(`
                      Could not find a schema.prisma file that is required for this command.
                      You can either provide it with --schema, set it as \`prisma.schema\` in your package.json or put it into the default location ./prisma/schema.prisma https://pris.ly/d/prisma-schema-location
                  `)
  })

  it('should fail if nativeTypes VarChar on sqlite', async () => {
    ctx.fixture('nativeTypes-sqlite')
    const result = DbPush.new().parse([])
    await expect(result).rejects.toThrowErrorMatchingInlineSnapshot(`
            P1012

            error: Native type VarChar is not supported for sqlite connector.
              -->  schema.prisma:12
               | 
            11 |   id   Int    @id
            12 |   name String @db.VarChar(100)
               | 


          `)
  })

  it('--force flag renamed', async () => {
    ctx.fixture('reset')
    const result = DbPush.new().parse(['--force'])
    await expect(result).rejects.toMatchInlineSnapshot(
      `The --force flag was renamed to --accept-data-loss in 2.17.0, use prisma db push --accept-data-loss`,
    )
    expect(ctx.mocked['console.info'].mock.calls.join('\n')).toMatchInlineSnapshot(``)
    expect(ctx.mocked['console.error'].mock.calls.join('\n')).toMatchInlineSnapshot(``)
  })

  it('already in sync', async () => {
    ctx.fixture('reset')
    const result = DbPush.new().parse([])
    await expect(result).resolves.toMatchInlineSnapshot(``)
    expect(ctx.mocked['console.info'].mock.calls.join('\n')).toMatchInlineSnapshot(`
      Prisma schema loaded from prisma/schema.prisma
      Datasource "my_db": SQLite database "dev.db" at "file:dev.db"

      🚀  Your database is now in sync with your Prisma schema. Done in XXXms
    `)
    expect(ctx.mocked['console.error'].mock.calls.join('\n')).toMatchInlineSnapshot(``)
  })

  it('missing SQLite db should be created next to the schema.prisma file', async () => {
    ctx.fixture('reset')
    ctx.fs.remove('prisma/dev.db')
    const schemaPath = 'prisma/schema.prisma'

    const result = DbPush.new().parse([])
    await expect(result).resolves.toMatchInlineSnapshot(``)
    expect(ctx.mocked['console.info'].mock.calls.join('\n')).toMatchInlineSnapshot(`
      Prisma schema loaded from prisma/schema.prisma
      Datasource "my_db": SQLite database "dev.db" at "file:dev.db"

      SQLite database dev.db created at file:dev.db

      🚀  Your database is now in sync with your Prisma schema. Done in XXXms
    `)
    await expect(ctx.fs.inspect(schemaPath)?.size).toBeGreaterThan(0)
    await expect(ctx.fs.inspect(path.join(path.dirname(schemaPath), 'dev.db'))?.size).toBeGreaterThan(0)
    await expect(ctx.fs.inspect('dev.db')?.size).toBeUndefined()

    expect(ctx.mocked['console.error'].mock.calls.join('\n')).toMatchInlineSnapshot(``)
  })

  it('missing SQLite db should be created next to the --schema path', async () => {
    ctx.fixture('reset')
    ctx.fs.remove('prisma/dev.db')

    const oldSchemaPath = 'prisma/schema.prisma'
    const newSchemaPath = 'something/schema.prisma'
    ctx.fs.move(oldSchemaPath, newSchemaPath)

    const result = DbPush.new().parse(['--schema', newSchemaPath])
    await expect(result).resolves.toMatchInlineSnapshot(``)
    expect(ctx.mocked['console.info'].mock.calls.join('\n')).toMatchInlineSnapshot(`
      Prisma schema loaded from something/schema.prisma
      Datasource "my_db": SQLite database "dev.db" at "file:dev.db"

      SQLite database dev.db created at file:dev.db

      🚀  Your database is now in sync with your Prisma schema. Done in XXXms
    `)
    await expect(ctx.fs.inspect(oldSchemaPath)?.size).toBeUndefined()
    await expect(ctx.fs.inspect(newSchemaPath)?.size).toBeGreaterThan(0)
    await expect(ctx.fs.inspect(path.join(path.dirname(oldSchemaPath), 'dev.db'))?.size).toBeUndefined()
    await expect(ctx.fs.inspect(path.join(path.dirname(newSchemaPath), 'dev.db'))?.size).toBeGreaterThan(0)
    await expect(ctx.fs.inspect('dev.db')?.size).toBeUndefined()

    expect(ctx.mocked['console.error'].mock.calls.join('\n')).toMatchInlineSnapshot(``)
  })

  it('should ask for --accept-data-loss if not provided in CI', async () => {
    ctx.fixture('existing-db-warnings')
    process.env.GITHUB_ACTIONS = '1'

    const result = DbPush.new().parse([])
    await expect(result).rejects.toMatchInlineSnapshot(
      `Use the --accept-data-loss flag to ignore the data loss warnings like prisma db push --accept-data-loss`,
    )
    expect(ctx.mocked['console.log'].mock.calls.join('\n')).toMatchInlineSnapshot(``)
    expect(ctx.mocked['console.error'].mock.calls.join('\n')).toMatchInlineSnapshot(``)
  })

  // eslint-disable-next-line jest/no-identical-title
  it('dataloss warnings accepted (prompt)', async () => {
    ctx.fixture('existing-db-warnings')

    prompt.inject(['y'])

    const result = DbPush.new().parse([])
    await expect(result).resolves.toMatchInlineSnapshot(``)
    expect(ctx.mocked['console.info'].mock.calls.join('\n')).toMatchInlineSnapshot(`
      Prisma schema loaded from prisma/schema.prisma
      Datasource "my_db": SQLite database "dev.db" at "file:dev.db"

      ⚠️  There might be data loss when applying the changes:

        • You are about to drop the \`Blog\` table, which is not empty (1 rows).



      🚀  Your database is now in sync with your Prisma schema. Done in XXXms
    `)
    expect(ctx.mocked['console.error'].mock.calls.join('\n')).toMatchInlineSnapshot(``)
  })

  // eslint-disable-next-line jest/no-identical-title
  it('dataloss warnings cancelled (prompt)', async () => {
    ctx.fixture('existing-db-warnings')
    const mockExit = jest.spyOn(process, 'exit').mockImplementation((number) => {
      throw new Error('process.exit: ' + number)
    })

    prompt.inject([new Error()]) // simulate user cancellation

    const result = DbPush.new().parse([])
    await expect(result).rejects.toMatchInlineSnapshot(`process.exit: 130`)
    expect(ctx.mocked['console.info'].mock.calls.join('\n')).toMatchInlineSnapshot(`
      Prisma schema loaded from prisma/schema.prisma
      Datasource "my_db": SQLite database "dev.db" at "file:dev.db"

      ⚠️  There might be data loss when applying the changes:

        • You are about to drop the \`Blog\` table, which is not empty (1 rows).


      Push cancelled.
    `)
    expect(ctx.mocked['console.error'].mock.calls.join('\n')).toMatchInlineSnapshot(``)
    expect(mockExit).toBeCalledWith(130)
  })

  // eslint-disable-next-line jest/no-identical-title
  it('--accept-data-loss flag', async () => {
    ctx.fixture('existing-db-warnings')
    const result = DbPush.new().parse(['--accept-data-loss'])
    await expect(result).resolves.toMatchInlineSnapshot(``)
    expect(ctx.mocked['console.info'].mock.calls.join('\n')).toMatchInlineSnapshot(`
      Prisma schema loaded from prisma/schema.prisma
      Datasource "my_db": SQLite database "dev.db" at "file:dev.db"

      ⚠️  There might be data loss when applying the changes:

        • You are about to drop the \`Blog\` table, which is not empty (1 rows).


      🚀  Your database is now in sync with your Prisma schema. Done in XXXms
    `)
    expect(ctx.mocked['console.error'].mock.calls.join('\n')).toMatchInlineSnapshot(``)
  })

  it('unexecutable - drop accepted (prompt)', async () => {
    ctx.fixture('existing-db-1-unexecutable-schema-change')

    prompt.inject(['y'])

    const result = DbPush.new().parse([])

    const sqliteDbSizeBefore = ctx.fs.inspect('prisma/dev.db')!.size

    await expect(result).resolves.toMatchInlineSnapshot(``)

    const sqliteDbSizeAfter = ctx.fs.inspect('prisma/dev.db')!.size

    expect(sqliteDbSizeBefore).toBeGreaterThan(10000)
    expect(sqliteDbSizeAfter).toBeGreaterThan(10000)
    expect(sqliteDbSizeAfter).toBeLessThan(sqliteDbSizeBefore)

    expect(ctx.mocked['console.info'].mock.calls.join('\n')).toMatchInlineSnapshot(`
      Prisma schema loaded from prisma/schema.prisma
      Datasource "my_db": SQLite database "dev.db" at "file:dev.db"


      ⚠️ We found changes that cannot be executed:

        • Made the column \`fullname\` on table \`Blog\` required, but there are 1 existing NULL values.


      The SQLite database "dev.db" from "file:dev.db" was successfully reset.

      🚀  Your database is now in sync with your Prisma schema. Done in XXXms
    `)
    expect(ctx.mocked['console.error'].mock.calls.join('\n')).toMatchInlineSnapshot(``)
  })

  it('unexecutable - drop cancelled (prompt)', async () => {
    ctx.fixture('existing-db-warnings')
    const mockExit = jest.spyOn(process, 'exit').mockImplementation((number) => {
      throw new Error('process.exit: ' + number)
    })

    prompt.inject([new Error()]) // simulate user cancellation

    const result = DbPush.new().parse([])
    await expect(result).rejects.toMatchInlineSnapshot(`process.exit: 130`)
    expect(ctx.mocked['console.info'].mock.calls.join('\n')).toMatchInlineSnapshot(`
      Prisma schema loaded from prisma/schema.prisma
      Datasource "my_db": SQLite database "dev.db" at "file:dev.db"

      ⚠️  There might be data loss when applying the changes:

        • You are about to drop the \`Blog\` table, which is not empty (1 rows).


      Push cancelled.
    `)
    expect(ctx.mocked['console.error'].mock.calls.join('\n')).toMatchInlineSnapshot(``)
    expect(mockExit).toBeCalledWith(130)
  })

  it('unexecutable - --force-reset', async () => {
    ctx.fixture('existing-db-1-unexecutable-schema-change')
    const result = DbPush.new().parse(['--force-reset'])
    await expect(result).resolves.toMatchInlineSnapshot(``)
    expect(ctx.mocked['console.info'].mock.calls.join('\n')).toMatchInlineSnapshot(`
      Prisma schema loaded from prisma/schema.prisma
      Datasource "my_db": SQLite database "dev.db" at "file:dev.db"

      The SQLite database "dev.db" at "file:dev.db" was successfully reset.

      🚀  Your database is now in sync with your Prisma schema. Done in XXXms
    `)
    expect(ctx.mocked['console.error'].mock.calls.join('\n')).toMatchInlineSnapshot(``)
  })

  it('unexecutable - should ask for --force-reset in CI', async () => {
    ctx.fixture('existing-db-1-unexecutable-schema-change')
    process.env.GITHUB_ACTIONS = '1'

    const result = DbPush.new().parse([])
    await expect(result).rejects.toMatchInlineSnapshot(`

                                    ⚠️ We found changes that cannot be executed:

                                      • Made the column \`fullname\` on table \`Blog\` required, but there are 1 existing NULL values.

                                    Use the --force-reset flag to drop the database before push like prisma db push --force-reset
                                    All data will be lost.
                                            
                        `)
    expect(ctx.mocked['console.log'].mock.calls.join('\n')).toMatchInlineSnapshot(``)
    expect(ctx.mocked['console.error'].mock.calls.join('\n')).toMatchInlineSnapshot(``)
  })
})

describeIf(process.platform !== 'win32' && !process.env.TEST_SKIP_MONGODB)('push existing-db with mongodb', () => {
  const setupParams: SetupParams = {
    connectionString:
      process.env.TEST_MONGO_URI_MIGRATE_EXISTING_DB ||
      'mongodb://root:prisma@localhost:27017/tests-migrate-existing-db?authSource=admin',
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

  // eslint-disable-next-line jest/no-identical-title
  it('dataloss warnings accepted (prompt)', async () => {
    ctx.fixture('existing-db-warnings-mongodb')

    prompt.inject(['y'])

    const result = DbPush.new().parse([])
    await expect(result).resolves.toMatchInlineSnapshot(``)
    expect(ctx.mocked['console.info'].mock.calls.join('\n')).toMatchInlineSnapshot(`
      Prisma schema loaded from prisma/schema.prisma
      Datasource "my_db": MongoDB database "tests-migrate-existing-db" at "localhost:27017"
      Applying the following changes:

      [+] Collection \`Post\`


      🚀  Your database indexes are now in sync with your Prisma schema. Done in XXXms
    `)
    expect(ctx.mocked['console.error'].mock.calls.join('\n')).toMatchInlineSnapshot(``)
  })

  // eslint-disable-next-line jest/no-identical-title
  it('dataloss warnings cancelled (prompt)', async () => {
    ctx.fixture('existing-db-warnings-mongodb')
    const mockExit = jest.spyOn(process, 'exit').mockImplementation((number) => {
      throw new Error('process.exit: ' + number)
    })

    prompt.inject([new Error()]) // simulate user cancellation

    const result = DbPush.new().parse([])
    await expect(result).resolves.toMatchInlineSnapshot(``)
    expect(ctx.mocked['console.info'].mock.calls.join('\n')).toMatchInlineSnapshot(`
      Prisma schema loaded from prisma/schema.prisma
      Datasource "my_db": MongoDB database "tests-migrate-existing-db" at "localhost:27017"
      Applying the following changes:

      [+] Collection \`Post\`


      🚀  Your database indexes are now in sync with your Prisma schema. Done in XXXms
    `)
    expect(ctx.mocked['console.error'].mock.calls.join('\n')).toMatchInlineSnapshot(``)
    expect(mockExit).toBeCalledWith(130)
  })

  // eslint-disable-next-line jest/no-identical-title
  it('--accept-data-loss flag', async () => {
    ctx.fixture('existing-db-warnings-mongodb')
    const result = DbPush.new().parse(['--accept-data-loss'])
    await expect(result).resolves.toMatchInlineSnapshot(``)
    expect(ctx.mocked['console.info'].mock.calls.join('\n')).toMatchInlineSnapshot(`
      Prisma schema loaded from prisma/schema.prisma
      Datasource "my_db": MongoDB database "tests-migrate-existing-db" at "localhost:27017"
      Applying the following changes:

      [+] Collection \`Post\`


      🚀  Your database indexes are now in sync with your Prisma schema. Done in XXXms
    `)
    expect(ctx.mocked['console.error'].mock.calls.join('\n')).toMatchInlineSnapshot(``)
  })
})
