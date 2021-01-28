process.env.MIGRATE_SKIP_GENERATE = '1'
process.env.GITHUB_ACTIONS = '1'

import prompt from 'prompts'
import { MigrateReset } from '../commands/MigrateReset'
import { consoleContext, Context } from './__helpers__/context'

const ctx = Context.new().add(consoleContext()).assemble()

describe('common', () => {
  it('wrong flag', async () => {
    const commandInstance = MigrateReset.new()
    const spy = jest
      .spyOn(commandInstance, 'help')
      .mockImplementation(() => 'Help Me')

    await commandInstance.parse(['--something'])
    expect(spy).toHaveBeenCalledTimes(1)
    spy.mockRestore()
  })
  it('help flag', async () => {
    const commandInstance = MigrateReset.new()
    const spy = jest
      .spyOn(commandInstance, 'help')
      .mockImplementation(() => 'Help Me')

    await commandInstance.parse(['--help'])
    expect(spy).toHaveBeenCalledTimes(1)
    spy.mockRestore()
  })
  it('should fail if no schema file', async () => {
    ctx.fixture('empty')
    const result = MigrateReset.new().parse(['--preview-feature'])
    await expect(result).rejects.toThrowErrorMatchingInlineSnapshot(`
            Could not find a schema.prisma file that is required for this command.
            You can either provide it with --schema, set it as \`prisma.schema\` in your package.json or put it into the default location ./prisma/schema.prisma https://pris.ly/d/prisma-schema-location
          `)
  })
  it('should fail if old migrate', async () => {
    ctx.fixture('old-migrate')
    const result = MigrateReset.new().parse(['--preview-feature'])
    await expect(result).rejects.toThrowErrorMatchingInlineSnapshot(`
            The migrations folder contains migration files from an older version of Prisma Migrate which is not compatible.

            Read more about how to upgrade to the new version of Migrate:
            https://pris.ly/d/migrate-upgrade
          `)
  })
  it('should fail if no flag', async () => {
    ctx.fixture('empty')
    const result = MigrateReset.new().parse([])
    await expect(result).rejects.toThrowErrorMatchingInlineSnapshot(`
            This feature is currently in Preview. There may be bugs and it's not recommended to use it in production environments.
            Please provide the --preview-feature flag to use this command.
          `)
  })
  it('should fail if experimental flag', async () => {
    ctx.fixture('empty')
    const result = MigrateReset.new().parse(['--experimental'])
    await expect(result).rejects.toThrowErrorMatchingInlineSnapshot(`
            Prisma Migrate was Experimental and is now in Preview.
            WARNING this new iteration has some breaking changes to use it it's recommended to read the documentation first and replace the --experimental flag with --preview-feature.
          `)
  })
  it('should fail if early access flag', async () => {
    ctx.fixture('empty')
    const result = MigrateReset.new().parse(['--early-access-feature'])
    await expect(result).rejects.toThrowErrorMatchingInlineSnapshot(`
            Prisma Migrate was in Early Access and is now in Preview.
            Replace the --early-access-feature flag with --preview-feature.
          `)
  })
})

describe('reset', () => {
  it('should work (prompt)', async () => {
    ctx.fixture('reset')

    prompt.inject(['y']) // simulate user yes input

    const result = MigrateReset.new().parse(['--preview-feature'])
    await expect(result).resolves.toMatchInlineSnapshot(``)
    expect(ctx.mocked['console.info'].mock.calls.join('\n'))
      .toMatchInlineSnapshot(`
      Prisma schema loaded from prisma/schema.prisma
      Datasource "my_db": SQLite database "dev.db" at "file:dev.db"


      Database reset successful

      The following migration(s) have been applied:

      migrations/
        └─ 20201231000000_init/
          └─ migration.sql
    `)
    expect(
      ctx.mocked['console.error'].mock.calls.join('\n'),
    ).toMatchInlineSnapshot(``)
  })

  it('should work (--force)', async () => {
    ctx.fixture('reset')

    const result = MigrateReset.new().parse(['--preview-feature', '--force'])
    await expect(result).resolves.toMatchInlineSnapshot(``)
    expect(ctx.mocked['console.info'].mock.calls.join('\n'))
      .toMatchInlineSnapshot(`
      Prisma schema loaded from prisma/schema.prisma
      Datasource "my_db": SQLite database "dev.db" at "file:dev.db"

      Database reset successful

      The following migration(s) have been applied:

      migrations/
        └─ 20201231000000_init/
          └─ migration.sql
    `)
    expect(
      ctx.mocked['console.error'].mock.calls.join('\n'),
    ).toMatchInlineSnapshot(``)
  })

  it('with missing db', async () => {
    ctx.fixture('reset')
    ctx.fs.remove('prisma/dev.db')

    const result = MigrateReset.new().parse(['--preview-feature', '--force'])
    await expect(result).resolves.toMatchInlineSnapshot(``)
    expect(ctx.mocked['console.info'].mock.calls.join('\n'))
      .toMatchInlineSnapshot(`
      Prisma schema loaded from prisma/schema.prisma
      Datasource "my_db": SQLite database "dev.db" at "file:dev.db"

      SQLite database dev.db created at file:dev.db

      Database reset successful

      The following migration(s) have been applied:

      migrations/
        └─ 20201231000000_init/
          └─ migration.sql
    `)
    expect(
      ctx.mocked['console.error'].mock.calls.join('\n'),
    ).toMatchInlineSnapshot(``)
  })

  it('without the migrations directory should fail (prompt)', async () => {
    ctx.fixture('reset')
    ctx.fs.remove('prisma/migrations')

    prompt.inject(['y']) // simulate user yes input

    const result = MigrateReset.new().parse(['--preview-feature'])
    await expect(result).resolves.toMatchInlineSnapshot(``)
    expect(ctx.mocked['console.info'].mock.calls.join('\n'))
      .toMatchInlineSnapshot(`
      Prisma schema loaded from prisma/schema.prisma
      Datasource "my_db": SQLite database "dev.db" at "file:dev.db"


      Database reset successful
    `)
    expect(
      ctx.mocked['console.error'].mock.calls.join('\n'),
    ).toMatchInlineSnapshot(``)
  })

  it('should be cancelled if user send n (prompt)', async () => {
    ctx.fixture('reset')
    const mockExit = jest.spyOn(process, 'exit').mockImplementation()

    prompt.inject([new Error()]) // simulate user cancellation

    const result = MigrateReset.new().parse(['--preview-feature'])
    await expect(result).resolves.toMatchInlineSnapshot(``)
    expect(ctx.mocked['console.info'].mock.calls.join('\n'))
      .toMatchInlineSnapshot(`
      Prisma schema loaded from prisma/schema.prisma
      Datasource "my_db": SQLite database "dev.db" at "file:dev.db"


      Reset cancelled.
    `)
    expect(
      ctx.mocked['console.error'].mock.calls.join('\n'),
    ).toMatchInlineSnapshot(``)
    expect(mockExit).toBeCalledWith(0)
  })

  it('reset should error in unattended environment', async () => {
    ctx.fixture('reset')
    const result = MigrateReset.new().parse(['--preview-feature'])
    await expect(result).rejects.toMatchInlineSnapshot(
      `We detected that your environment is non-interactive. Running this command in not supported in this context.`,
    )
    expect(
      ctx.mocked['console.error'].mock.calls.join('\n'),
    ).toMatchInlineSnapshot(``)
  })

  it('reset - multiple seed files', async () => {
    ctx.fixture('seed-sqlite')
    prompt.inject(['y']) // simulate user yes input

    const result = MigrateReset.new().parse(['--preview-feature'])
    await expect(result).rejects.toMatchInlineSnapshot(`
            More than one seed file was found in \`prisma\` directory.
            This command only supports one seed file: Use \`seed.ts\`, \`.js\`, \`.sh\` or \`.go\`.
          `)
    expect(
      ctx.mocked['console.error'].mock.calls.join('\n'),
    ).toMatchInlineSnapshot(``)
  })

  it('reset - multiple seed files - --skip-seed', async () => {
    ctx.fixture('seed-sqlite')
    prompt.inject(['y']) // simulate user yes input

    const result = MigrateReset.new().parse([
      '--skip-seed',
      '--preview-feature',
    ])
    await expect(result).resolves.toMatchInlineSnapshot(``)
    expect(
      ctx.mocked['console.error'].mock.calls.join('\n'),
    ).toMatchInlineSnapshot(``)
  })

  it('reset - seed.js', async () => {
    ctx.fixture('seed-sqlite')
    // ctx.fs.remove('prisma/seed.js')
    ctx.fs.remove('prisma/seed.ts')
    ctx.fs.remove('prisma/seed.sh')
    ctx.fs.remove('prisma/seed.go')
    prompt.inject(['y']) // simulate user yes input

    const result = MigrateReset.new().parse(['--preview-feature'])
    await expect(result).resolves.toMatchInlineSnapshot(``)
    expect(
      ctx.mocked['console.error'].mock.calls.join('\n'),
    ).toMatchInlineSnapshot(``)
  })
})
