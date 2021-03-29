process.env.GITHUB_ACTIONS = '1'
process.env.PRISMA_MIGRATE_SKIP_GENERATE = '1'

import prompt from 'prompts'
import { DbPush } from '../commands/DbPush'
import { consoleContext, Context } from './__helpers__/context'

const ctx = Context.new().add(consoleContext()).assemble()

describe('push', () => {
  it('requires --preview-feature flag', async () => {
    ctx.fixture('empty')

    const result = DbPush.new().parse([])
    await expect(result).rejects.toThrowErrorMatchingInlineSnapshot(`
            This feature is currently in Preview. There may be bugs and it's not recommended to use it in production environments.
            Please provide the --preview-feature flag to use this command.
          `)
  })

  it('should fail if no schema file', async () => {
    ctx.fixture('empty')

    const result = DbPush.new().parse(['--preview-feature'])
    await expect(result).rejects.toThrowErrorMatchingInlineSnapshot(`
                      Could not find a schema.prisma file that is required for this command.
                      You can either provide it with --schema, set it as \`prisma.schema\` in your package.json or put it into the default location ./prisma/schema.prisma https://pris.ly/d/prisma-schema-location
                  `)
  })

  it('should fail if nativeTypes VarChar on sqlite', async () => {
    ctx.fixture('nativeTypes-sqlite')
    const result = DbPush.new().parse(['--preview-feature'])
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
    const result = DbPush.new().parse(['--preview-feature', '--force'])
    await expect(result).rejects.toMatchInlineSnapshot(
      `The --force flag was renamed to --accept-data-loss in 2.17.0, use prisma db push --preview-feature --accept-data-loss`,
    )
    expect(
      ctx.mocked['console.info'].mock.calls.join('\n'),
    ).toMatchInlineSnapshot(``)
    expect(
      ctx.mocked['console.error'].mock.calls.join('\n'),
    ).toMatchInlineSnapshot(``)
  })

  it('already in sync', async () => {
    ctx.fixture('reset')
    const result = DbPush.new().parse(['--preview-feature'])
    await expect(result).resolves.toMatchInlineSnapshot(``)
    expect(ctx.mocked['console.info'].mock.calls.join('\n'))
      .toMatchInlineSnapshot(`
      Prisma schema loaded from prisma/schema.prisma
      Datasource "my_db": SQLite database "dev.db" at "file:dev.db"

      🚀  Your database is now in sync with your schema. Done in XXms
    `)
    expect(
      ctx.mocked['console.error'].mock.calls.join('\n'),
    ).toMatchInlineSnapshot(``)
  })

  it('missing db', async () => {
    ctx.fixture('reset')
    ctx.fs.remove('prisma/dev.db')

    const result = DbPush.new().parse(['--preview-feature'])
    await expect(result).resolves.toMatchInlineSnapshot(``)
    expect(ctx.mocked['console.info'].mock.calls.join('\n'))
      .toMatchInlineSnapshot(`
      Prisma schema loaded from prisma/schema.prisma
      Datasource "my_db": SQLite database "dev.db" at "file:dev.db"

      SQLite database dev.db created at file:dev.db


      🚀  Your database is now in sync with your schema. Done in XXms
    `)
    expect(
      ctx.mocked['console.error'].mock.calls.join('\n'),
    ).toMatchInlineSnapshot(``)
  })

  it('should ask for --accept-data-loss if not provided in CI', async () => {
    ctx.fixture('existing-db-warnings')
    const result = DbPush.new().parse(['--preview-feature'])
    await expect(result).rejects.toMatchInlineSnapshot(
      `Use the --accept-data-loss flag to ignore the data loss warnings like prisma db push --preview-feature --accept-data-loss`,
    )
    expect(
      ctx.mocked['console.log'].mock.calls.join('\n'),
    ).toMatchInlineSnapshot(``)
    expect(
      ctx.mocked['console.error'].mock.calls.join('\n'),
    ).toMatchInlineSnapshot(``)
  })

  it('dataloss warnings accepted (prompt)', async () => {
    ctx.fixture('existing-db-warnings')

    prompt.inject(['y'])

    const result = DbPush.new().parse(['--preview-feature'])
    await expect(result).resolves.toMatchInlineSnapshot(``)
    expect(ctx.mocked['console.info'].mock.calls.join('\n'))
      .toMatchInlineSnapshot(`
      Prisma schema loaded from prisma/schema.prisma
      Datasource "my_db": SQLite database "dev.db" at "file:dev.db"

      ⚠️  There might be data loss when applying the changes:

        • You are about to drop the \`Blog\` table, which is not empty (1 rows).



      🚀  Your database is now in sync with your schema. Done in XXms
    `)
    expect(
      ctx.mocked['console.error'].mock.calls.join('\n'),
    ).toMatchInlineSnapshot(``)
  })

  it('dataloss warnings cancelled (prompt)', async () => {
    ctx.fixture('existing-db-warnings')
    const mockExit = jest.spyOn(process, 'exit').mockImplementation()

    prompt.inject([new Error()]) // simulate user cancellation

    const result = DbPush.new().parse(['--preview-feature'])
    await expect(result).resolves.toMatchInlineSnapshot(``)
    expect(ctx.mocked['console.info'].mock.calls.join('\n'))
      .toMatchInlineSnapshot(`
      Prisma schema loaded from prisma/schema.prisma
      Datasource "my_db": SQLite database "dev.db" at "file:dev.db"

      ⚠️  There might be data loss when applying the changes:

        • You are about to drop the \`Blog\` table, which is not empty (1 rows).


      Push cancelled.
    `)
    expect(
      ctx.mocked['console.error'].mock.calls.join('\n'),
    ).toMatchInlineSnapshot(``)
    expect(mockExit).toBeCalledWith(0)
  })

  it('--accept-data-loss flag', async () => {
    ctx.fixture('existing-db-warnings')
    const result = DbPush.new().parse([
      '--preview-feature',
      '--accept-data-loss',
    ])
    await expect(result).resolves.toMatchInlineSnapshot(``)
    expect(ctx.mocked['console.info'].mock.calls.join('\n'))
      .toMatchInlineSnapshot(`
      Prisma schema loaded from prisma/schema.prisma
      Datasource "my_db": SQLite database "dev.db" at "file:dev.db"

      ⚠️  There might be data loss when applying the changes:

        • You are about to drop the \`Blog\` table, which is not empty (1 rows).


      🚀  Your database is now in sync with your schema. Done in XXms
    `)
    expect(
      ctx.mocked['console.error'].mock.calls.join('\n'),
    ).toMatchInlineSnapshot(``)
  })

  it('unexecutable - drop accepted (prompt)', async () => {
    ctx.fixture('existing-db-1-unexecutable-schema-change')

    prompt.inject(['y'])

    const result = DbPush.new().parse(['--preview-feature'])
    await expect(result).resolves.toMatchInlineSnapshot(``)
    expect(ctx.mocked['console.info'].mock.calls.join('\n'))
      .toMatchInlineSnapshot(`
      Prisma schema loaded from prisma/schema.prisma
      Datasource "my_db": SQLite database "dev.db" at "file:dev.db"


      ⚠️ We found changes that cannot be executed:

        • Made the column \`fullname\` on table \`Blog\` required, but there are 1 existing NULL values.


      The SQLite database "dev.db" from "file:dev.db" was successfully reset.

      🚀  Your database is now in sync with your schema. Done in XXms
    `)
    expect(
      ctx.mocked['console.error'].mock.calls.join('\n'),
    ).toMatchInlineSnapshot(``)
  })

  it('unexecutable - drop cancelled (prompt)', async () => {
    ctx.fixture('existing-db-warnings')
    const mockExit = jest.spyOn(process, 'exit').mockImplementation()

    prompt.inject([new Error()]) // simulate user cancellation

    const result = DbPush.new().parse(['--preview-feature'])
    await expect(result).resolves.toMatchInlineSnapshot(``)
    expect(ctx.mocked['console.info'].mock.calls.join('\n'))
      .toMatchInlineSnapshot(`
      Prisma schema loaded from prisma/schema.prisma
      Datasource "my_db": SQLite database "dev.db" at "file:dev.db"

      ⚠️  There might be data loss when applying the changes:

        • You are about to drop the \`Blog\` table, which is not empty (1 rows).


      Push cancelled.
    `)
    expect(
      ctx.mocked['console.error'].mock.calls.join('\n'),
    ).toMatchInlineSnapshot(``)
    expect(mockExit).toBeCalledWith(0)
  })

  it('unexecutable - --force-reset', async () => {
    ctx.fixture('existing-db-1-unexecutable-schema-change')
    const result = DbPush.new().parse(['--preview-feature', '--force-reset'])
    await expect(result).resolves.toMatchInlineSnapshot(``)
    expect(ctx.mocked['console.info'].mock.calls.join('\n'))
      .toMatchInlineSnapshot(`
      Prisma schema loaded from prisma/schema.prisma
      Datasource "my_db": SQLite database "dev.db" at "file:dev.db"

      The SQLite database "dev.db" from "file:dev.db" was successfully reset.

      🚀  Your database is now in sync with your schema. Done in XXms
    `)
    expect(
      ctx.mocked['console.error'].mock.calls.join('\n'),
    ).toMatchInlineSnapshot(``)
  })

  it('unexecutable - should ask for --force-reset in CI', async () => {
    ctx.fixture('existing-db-1-unexecutable-schema-change')
    const result = DbPush.new().parse(['--preview-feature'])
    await expect(result).rejects.toMatchInlineSnapshot(`

            ⚠️ We found changes that cannot be executed:

              • Made the column \`fullname\` on table \`Blog\` required, but there are 1 existing NULL values.

            Use the --force-reset flag to drop the database before push like prisma db push --preview-feature --force-reset
            All data will be lost.
                    
          `)
    expect(
      ctx.mocked['console.log'].mock.calls.join('\n'),
    ).toMatchInlineSnapshot(``)
    expect(
      ctx.mocked['console.error'].mock.calls.join('\n'),
    ).toMatchInlineSnapshot(``)
  })
})
