process.env.MIGRATE_SKIP_GENERATE = '1'

import { MigrateReset } from '../commands/MigrateReset'
import { consoleContext, Context } from './__helpers__/context'

const ctx = Context.new().add(consoleContext()).assemble()

let stdin
beforeEach(() => {
  stdin = require('mock-stdin').stdin()
})

process.env.GITHUB_ACTIONS = '1'

describe('reset', () => {
  it('if no schema file should fail', async () => {
    ctx.fixture('empty')

    const result = MigrateReset.new().parse(['--early-access-feature'])
    await expect(result).rejects.toThrowErrorMatchingInlineSnapshot(`
            Could not find a schema.prisma file that is required for this command.
            You can either provide it with --schema, set it as \`prisma.schema\` in your package.json or put it into the default location ./prisma/schema.prisma https://pris.ly/d/prisma-schema-location
          `)
  })

  it('with missing db should fail', async () => {
    ctx.fixture('reset')
    ctx.fs.remove('prisma/dev.db')

    // setTimeout(() => stdin.send(`y\r`), 100)
    const result = MigrateReset.new().parse([
      '--early-access-feature',
      '--force',
    ])
    await expect(result).rejects.toMatchInlineSnapshot(`
            Invariant violation: migration persistence is not initialized.
               0: migration_core::api::ApplyMigrations
                         at migration-engine/core/src/api.rs:91

          `)
    expect(
      ctx.mocked['console.error'].mock.calls.join('\n'),
    ).toMatchInlineSnapshot(``)
  })

  it('should work', async () => {
    ctx.fixture('reset')

    // setTimeout(() => stdin.send(`y\r`), 100)
    const result = MigrateReset.new().parse([
      '--early-access-feature',
      '--force',
    ])
    await expect(result).resolves.toMatchInlineSnapshot(``)
    expect(ctx.mocked['console.info'].mock.calls.join('\n'))
      .toMatchInlineSnapshot(`
      Prisma Schema loaded from prisma/schema.prisma

      Database reset successful - Prisma Migrate applied the following migration(s):

      migrations/
        └─ 20201231000000_init/
          └─ migration.sql
    `)
    expect(
      ctx.mocked['console.error'].mock.calls.join('\n'),
    ).toMatchInlineSnapshot(``)
  })

  it('without the migrations directory should fail', async () => {
    ctx.fixture('reset')
    ctx.fs.remove('prisma/migrations')

    const result = MigrateReset.new().parse([
      '--force',
      '--early-access-feature',
    ])
    await expect(result).resolves.toMatchInlineSnapshot(``)
    expect(ctx.mocked['console.info'].mock.calls.join('\n'))
      .toMatchInlineSnapshot(`
      Prisma Schema loaded from prisma/schema.prisma

      Database reset successful - Prisma Migrate didn't find unapplied migrations.
    `)
    expect(
      ctx.mocked['console.error'].mock.calls.join('\n'),
    ).toMatchInlineSnapshot(``)
  })

  // commented because can't run on CI
  it.skip('should be cancelled if user send n', async () => {
    ctx.fixture('reset')
    const mockExit = jest.spyOn(process, 'exit').mockImplementation()

    // setTimeout(() => stdin.send(`n\r`), 100)
    const result = MigrateReset.new().parse(['--early-access-feature'])
    await expect(result).resolves.toMatchInlineSnapshot(``)
    expect(
      ctx.mocked['console.info'].mock.calls.join('\n'),
    ).toMatchInlineSnapshot(``)
    expect(
      ctx.mocked['console.error'].mock.calls.join('\n'),
    ).toMatchInlineSnapshot(``)
    expect(mockExit).toBeCalledWith(0)
  })

  it('reset should ask for --force if not provided', async () => {
    ctx.fixture('reset')
    const result = MigrateReset.new().parse(['--early-access-feature'])
    await expect(result).rejects.toMatchInlineSnapshot(
      `Use the --force flag to use the reset command in an unnattended environment like prisma reset --force --early-access-feature`,
    )
    expect(
      ctx.mocked['console.error'].mock.calls.join('\n'),
    ).toMatchInlineSnapshot(``)
  })

  it('should work with --force', async () => {
    ctx.fixture('reset')
    const result = MigrateReset.new().parse([
      '--force',
      '--early-access-feature',
    ])
    await expect(result).resolves.toMatchInlineSnapshot(``)
    expect(ctx.mocked['console.info'].mock.calls.join('\n'))
      .toMatchInlineSnapshot(`
      Prisma Schema loaded from prisma/schema.prisma

      Database reset successful - Prisma Migrate applied the following migration(s):

      migrations/
        └─ 20201231000000_init/
          └─ migration.sql
    `)
    expect(
      ctx.mocked['console.error'].mock.calls.join('\n'),
    ).toMatchInlineSnapshot(``)
  })
})
