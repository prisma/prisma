import { MigrateReset } from '../commands/MigrateReset'
import { consoleContext, Context } from './__helpers__/context'

const ctx = Context.new().add(consoleContext()).assemble()

const keys = {
  up: '\x1B\x5B\x41',
  down: '\x1B\x5B\x42',
  enter: '\x0D',
  space: '\x20',
}

// helper function for timing
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms)) // Mock stdin so we can send messages to the CLI

let stdin
beforeEach(() => {
  stdin = require('mock-stdin').stdin()
})

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

    setTimeout(() => stdin.send(`y\r`), 100)
    const result = MigrateReset.new().parse(['--experimental'])
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

    setTimeout(() => stdin.send(`y\r`), 100)
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
  })

  it('reset should be cancelled if user send n', async () => {
    ctx.fixture('reset')
    const mockExit = jest.spyOn(process, 'exit').mockImplementation()

    setTimeout(() => stdin.send(`n\r`), 100)
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
