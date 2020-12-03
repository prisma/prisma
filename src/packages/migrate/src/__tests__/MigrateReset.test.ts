process.env.MIGRATE_SKIP_GENERATE = '1'
process.env.GITHUB_ACTIONS = '1'

import prompt from 'prompts'
import { MigrateReset } from '../commands/MigrateReset'
import { consoleContext, Context } from './__helpers__/context'

const ctx = Context.new().add(consoleContext()).assemble()

describe('reset', () => {
  it('if no schema file should fail', async () => {
    ctx.fixture('empty')

    const result = MigrateReset.new().parse(['--early-access-feature'])
    await expect(result).rejects.toThrowErrorMatchingInlineSnapshot(`
            Could not find a schema.prisma file that is required for this command.
            You can either provide it with --schema, set it as \`prisma.schema\` in your package.json or put it into the default location ./prisma/schema.prisma https://pris.ly/d/prisma-schema-location
          `)
  })

  it('should work (prompt)', async () => {
    ctx.fixture('reset')

    prompt.inject(['y']) // simulate user yes input

    const result = MigrateReset.new().parse(['--early-access-feature'])
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

  // it('should work (--force)', async () => {
  //   ctx.fixture('reset')

  //   const result = MigrateReset.new().parse([
  //     '--early-access-feature',
  //     '--force',
  //   ])
  //   await expect(result).resolves.toMatchInlineSnapshot(``)
  //   expect(ctx.mocked['console.info'].mock.calls.join('\n'))
  //     .toMatchInlineSnapshot(`
  //     Prisma schema loaded from prisma/schema.prisma

  //     Database reset successful

  //     The following migration(s) have been applied:

  //     migrations/
  //       └─ 20201231000000_init/
  //         └─ migration.sql
  //   `)
  //   expect(
  //     ctx.mocked['console.error'].mock.calls.join('\n'),
  //   ).toMatchInlineSnapshot(``)
  // })

  it('with missing db (prompt)', async () => {
    ctx.fixture('reset')
    ctx.fs.remove('prisma/dev.db')

    prompt.inject(['y']) // simulate user yes input

    const result = MigrateReset.new().parse(['--early-access-feature'])
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

  // it('with missing db (force)', async () => {
  //   ctx.fixture('reset')
  //   ctx.fs.remove('prisma/dev.db')

  //   const result = MigrateReset.new().parse([
  //     '--early-access-feature',
  //     '--force',
  //   ])
  //   await expect(result).resolves.toMatchInlineSnapshot(``)
  //   expect(ctx.mocked['console.info'].mock.calls.join('\n'))
  //     .toMatchInlineSnapshot(`
  //     Prisma schema loaded from prisma/schema.prisma

  //     Database reset successful

  //     The following migration(s) have been applied:

  //     migrations/
  //       └─ 20201231000000_init/
  //         └─ migration.sql
  //   `)
  //   expect(
  //     ctx.mocked['console.error'].mock.calls.join('\n'),
  //   ).toMatchInlineSnapshot(``)
  // })

  it('without the migrations directory should fail (prompt)', async () => {
    ctx.fixture('reset')
    ctx.fs.remove('prisma/migrations')

    prompt.inject(['y']) // simulate user yes input

    const result = MigrateReset.new().parse(['--early-access-feature'])
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

    const result = MigrateReset.new().parse(['--early-access-feature'])
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
    const result = MigrateReset.new().parse(['--early-access-feature'])
    await expect(result).rejects.toMatchInlineSnapshot(
      `We detected that your environment is non-interactive. Running this command in not supported in this context.`,
    )
    expect(
      ctx.mocked['console.error'].mock.calls.join('\n'),
    ).toMatchInlineSnapshot(``)
  })
})
