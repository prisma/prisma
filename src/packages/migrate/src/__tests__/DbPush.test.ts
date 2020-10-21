process.env.GITHUB_ACTIONS = '1'

import { DbPush } from '../commands/DbPush'
import { consoleContext, Context } from './__helpers__/context'

const ctx = Context.new().add(consoleContext()).assemble()

let stdin
beforeEach(() => {
  stdin = require('mock-stdin').stdin()
})

describe('push', () => {
  it('if no schema file should fail', async () => {
    ctx.fixture('empty')

    const result = DbPush.new().parse([])
    await expect(result).rejects.toThrowErrorMatchingInlineSnapshot(`
          Could not find a schema.prisma file that is required for this command.
          You can either provide it with --schema, set it as \`prisma.schema\` in your package.json or put it into the default location ./prisma/schema.prisma https://pris.ly/d/prisma-schema-location
        `)
  })

  it('already in sync', async () => {
    ctx.fixture('reset')

    // setTimeout(() => stdin.send(`y\r`), 100)
    const result = DbPush.new().parse(['--force'])
    await expect(result).resolves.toMatchInlineSnapshot(`

            ! Unknown or unexpected option: --experimental

            Push the state from your schema.prisma to your database

            Usage

              $ prisma db push

            Options

              -h, --help       Displays this help message
              -f, --force      Ignore data loss warnings

            Examples

              Push the local schema state to the database
              $ prisma db push

              Using --force to ignore data loss warnings
              $ prisma db push --force

          `)
    expect(
      ctx.mocked['console.info'].mock.calls.join('\n'),
    ).toMatchInlineSnapshot(``)
    expect(
      ctx.mocked['console.error'].mock.calls.join('\n'),
    ).toMatchInlineSnapshot(``)
  })

  it('missing db', async () => {
    ctx.fixture('reset')
    ctx.fs.remove('prisma/dev.db')

    const result = DbPush.new().parse(['--force'])
    await expect(result).resolves.toMatchInlineSnapshot(`

            ! Unknown or unexpected option: --experimental

            Push the state from your schema.prisma to your database

            Usage

              $ prisma db push

            Options

              -h, --help       Displays this help message
              -f, --force      Ignore data loss warnings

            Examples

              Push the local schema state to the database
              $ prisma db push

              Using --force to ignore data loss warnings
              $ prisma db push --force

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
    const result = DbPush.new().parse([])
    await expect(result).resolves.toMatchInlineSnapshot(``)
    expect(
      ctx.mocked['console.info'].mock.calls.join('\n'),
    ).toMatchInlineSnapshot(``)
    expect(
      ctx.mocked['console.error'].mock.calls.join('\n'),
    ).toMatchInlineSnapshot(``)
    expect(mockExit).toBeCalledWith(0)
  })

  it('should ask for --force if not provided', async () => {
    ctx.fixture('existing-db-warnings')
    const result = DbPush.new().parse([])
    await expect(result).rejects.toMatchInlineSnapshot(
      `Use the --force flag to ignore these warnings like prisma db push --force --experimental`,
    )
    expect(
      ctx.mocked['console.error'].mock.calls.join('\n'),
    ).toMatchInlineSnapshot(``)
  })

  it('should work with --force', async () => {
    ctx.fixture('reset')
    const result = DbPush.new().parse(['--force'])
    await expect(result).resolves.toMatchInlineSnapshot(`

            ! Unknown or unexpected option: --experimental

            Push the state from your schema.prisma to your database

            Usage

              $ prisma db push

            Options

              -h, --help       Displays this help message
              -f, --force      Ignore data loss warnings

            Examples

              Push the local schema state to the database
              $ prisma db push

              Using --force to ignore data loss warnings
              $ prisma db push --force

          `)
    expect(
      ctx.mocked['console.info'].mock.calls.join('\n'),
    ).toMatchInlineSnapshot(``)
    expect(
      ctx.mocked['console.error'].mock.calls.join('\n'),
    ).toMatchInlineSnapshot(``)
  })

  it('should work with -f', async () => {
    ctx.fixture('reset')
    const result = DbPush.new().parse(['--force'])
    await expect(result).resolves.toMatchInlineSnapshot(`

            ! Unknown or unexpected option: --experimental

            Push the state from your schema.prisma to your database

            Usage

              $ prisma db push

            Options

              -h, --help       Displays this help message
              -f, --force      Ignore data loss warnings

            Examples

              Push the local schema state to the database
              $ prisma db push

              Using --force to ignore data loss warnings
              $ prisma db push --force

          `)
    expect(
      ctx.mocked['console.info'].mock.calls.join('\n'),
    ).toMatchInlineSnapshot(``)
    expect(
      ctx.mocked['console.error'].mock.calls.join('\n'),
    ).toMatchInlineSnapshot(``)
  })
})
