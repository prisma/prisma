import { MigrateReset } from '../commands/MigrateReset'
import { consoleContext, Context } from './__helpers__/context'

const ctx = Context.new().add(consoleContext()).assemble()

let stdin
beforeEach(() => {
  stdin = require('mock-stdin').stdin()
})

process.env.GITHUB_ACTIONS = '1'

describe('reset', () => {
  it('reset if no schema file should fail', async () => {
    ctx.fixture('empty')

    const result = MigrateReset.new().parse(['--experimental'])
    await expect(result).rejects.toThrowErrorMatchingInlineSnapshot(`
          Could not find a schema.prisma file that is required for this command.
          You can either provide it with --schema, set it as \`prisma.schema\` in your package.json or put it into the default location ./prisma/schema.prisma https://pris.ly/d/prisma-schema-location
        `)
  })

  it('reset without the migrations directory should fail', async () => {
    ctx.fixture('reset')
    ctx.fs.remove('prisma/migrations')

    const result = MigrateReset.new().parse(['--force', '--experimental'])
    await expect(result).rejects.toMatchInlineSnapshot(`
                      Generic error: An error occurred when reading the migrations directory.

                  `)
    expect(
      ctx.mocked['console.error'].mock.calls.join('\n'),
    ).toMatchInlineSnapshot(``)
  })

  it('reset with missing db should fail', async () => {
    ctx.fixture('reset')
    ctx.fs.remove('prisma/dev.db')

    // setTimeout(() => stdin.send(`y\r`), 100)
    const result = MigrateReset.new().parse(['--experimental', '--force'])
    await expect(result).rejects.toMatchInlineSnapshot(`
                      P1014

                      The underlying table for model \`quaint._prisma_migrations\` does not exist.

                  `)
    expect(
      ctx.mocked['console.error'].mock.calls.join('\n'),
    ).toMatchInlineSnapshot(``)
  })

  it('reset should work', async () => {
    ctx.fixture('reset')

    // setTimeout(() => stdin.send(`y\r`), 100)
    const result = MigrateReset.new().parse(['--experimental', '--force'])
    await expect(result).resolves.toMatchInlineSnapshot(`

                        Database reset successful, Prisma Migrate applied the following migration(s):

                        migrations/
                          └─ 20201231000000_init/
                            └─ migration.sql

                    `)
    expect(
      ctx.mocked['console.error'].mock.calls.join('\n'),
    ).toMatchInlineSnapshot(``)
  })

  // commented because can't run on CI
  it.skip('reset should be cancelled if user send n', async () => {
    ctx.fixture('reset')
    const mockExit = jest.spyOn(process, 'exit').mockImplementation()

    // setTimeout(() => stdin.send(`n\r`), 100)
    const result = MigrateReset.new().parse(['--experimental'])
    await expect(result).resolves.toMatchInlineSnapshot(`

                        Database reset successful, Prisma Migrate applied the following migration(s):

                        migrations/
                          └─ 20201231000000_init/
                            └─ migration.sql

                    `)
    expect(
      ctx.mocked['console.error'].mock.calls.join('\n'),
    ).toMatchInlineSnapshot(``)
    expect(mockExit).toBeCalledWith(0)
  })

  it('reset should ask for --force if not provided', async () => {
    ctx.fixture('reset')
    const result = MigrateReset.new().parse(['--experimental'])
    await expect(result).rejects.toMatchInlineSnapshot(
      `Use the --force flag to use the reset command in an unnattended environment like prisma reset --force --experimental`,
    )
    expect(
      ctx.mocked['console.error'].mock.calls.join('\n'),
    ).toMatchInlineSnapshot(``)
  })

  it('reset should work with --force', async () => {
    ctx.fixture('reset')
    const result = MigrateReset.new().parse(['--force', '--experimental'])
    await expect(result).resolves.toMatchInlineSnapshot(`

                                  Database reset successful, Prisma Migrate applied the following migration(s):

                                  migrations/
                                    └─ 20201231000000_init/
                                      └─ migration.sql

                            `)
    expect(
      ctx.mocked['console.error'].mock.calls.join('\n'),
    ).toMatchInlineSnapshot(``)
  })
})
