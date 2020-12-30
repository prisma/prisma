process.env.GITHUB_ACTIONS = '1'
process.env.MIGRATE_SKIP_GENERATE = '1'

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

  it('should fail if nativeTypes feature is enabled', async () => {
    ctx.fixture('nativeTypes-sqlite')
    const result = DbPush.new().parse(['--preview-feature'])
    await expect(result).rejects.toThrowErrorMatchingInlineSnapshot(
      `"nativeTypes" preview feature is not supported yet. Remove it from your schema to use Prisma Migrate.`,
    )
    expect(ctx.mocked['console.info'].mock.calls.join('\n'))
      .toMatchInlineSnapshot(`
      Prisma schema loaded from prisma/schema.prisma
      Datasource "db": SQLite database "dev.db" at "file:./dev.db"
    `)
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

  it('already in sync (--force)', async () => {
    ctx.fixture('reset')
    const result = DbPush.new().parse(['--preview-feature', '--force'])
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

    const result = DbPush.new().parse(['--preview-feature', '--force'])
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

  it('should ask for --force if not provided', async () => {
    ctx.fixture('existing-db-warnings')
    const result = DbPush.new().parse(['--preview-feature'])
    await expect(result).rejects.toMatchInlineSnapshot(
      `Use the --force flag to ignore these warnings like prisma db push --preview-feature --force`,
    )
    expect(ctx.mocked['console.log'].mock.calls.join('\n'))
      .toMatchInlineSnapshot(`

                                          ⚠️  There might be data loss when applying the changes:

                                            • You are about to drop the \`Blog\` table, which is not empty (1 rows).

                            `)
    expect(
      ctx.mocked['console.error'].mock.calls.join('\n'),
    ).toMatchInlineSnapshot(``)
  })

  it('should work with --force', async () => {
    ctx.fixture('reset')
    const result = DbPush.new().parse(['--preview-feature', '--force'])
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

  it('should work with -f', async () => {
    ctx.fixture('reset')
    const result = DbPush.new().parse(['--preview-feature', '--force'])
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

  it('should fail if nativeTypes feature is enabled', async () => {
    ctx.fixture('nativeTypes-sqlite')
    const result = DbPush.new().parse(['--preview-feature'])
    await expect(result).rejects.toThrowErrorMatchingInlineSnapshot(
      `"nativeTypes" preview feature is not supported yet. Remove it from your schema to use Prisma Migrate.`,
    )
    expect(ctx.mocked['console.info'].mock.calls.join('\n'))
      .toMatchInlineSnapshot(`
      Prisma schema loaded from prisma/schema.prisma
      Datasource "db": SQLite database "dev.db" at "file:./dev.db"
    `)
    expect(
      ctx.mocked['console.error'].mock.calls.join('\n'),
    ).toMatchInlineSnapshot(``)
  })
})
