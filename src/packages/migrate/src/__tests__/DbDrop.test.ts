process.env.GITHUB_ACTIONS = '1'

import { DbDrop } from '../commands/DbDrop'
import { consoleContext, Context } from './__helpers__/context'

const ctx = Context.new().add(consoleContext()).assemble()

let stdin
beforeEach(() => {
  stdin = require('mock-stdin').stdin()
})

describe('drop', () => {
  it('if no schema file should fail', async () => {
    ctx.fixture('empty')

    const result = DbDrop.new().parse(['--experimental'])
    await expect(result).rejects.toThrowErrorMatchingInlineSnapshot(`
          Could not find a schema.prisma file that is required for this command.
          You can either provide it with --schema, set it as \`prisma.schema\` in your package.json or put it into the default location ./prisma/schema.prisma https://pris.ly/d/prisma-schema-location
        `)
  })

  it('with missing db should fail', async () => {
    ctx.fixture('reset')
    ctx.fs.remove('prisma/dev.db')

    // setTimeout(() => stdin.send(`y\r`), 100)
    const result = DbDrop.new().parse(['--experimental', '--force'])
    await expect(result).rejects.toMatchInlineSnapshot(`
            Failed to delete SQLite database at \`dev.db\`.
            No such file or directory (os error 2)


          `)
    expect(
      ctx.mocked['console.error'].mock.calls.join('\n'),
    ).toMatchInlineSnapshot(``)
  })

  it('should work', async () => {
    ctx.fixture('reset')

    // setTimeout(() => stdin.send(`y\r`), 100)
    const result = DbDrop.new().parse(['--experimental', '--force'])
    await expect(result).resolves.toMatchInlineSnapshot(`
            🚀  The SQLite database "dev.db" from "file:dev.db" was successfully dropped.

          `)
    expect(ctx.mocked['console.info'].mock.calls.join('\n'))
      .toMatchInlineSnapshot(`
      Prisma Schema loaded from prisma/schema.prisma

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
    const result = DbDrop.new().parse(['--experimental'])
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
    ctx.fixture('reset')
    const result = DbDrop.new().parse(['--experimental'])
    await expect(result).rejects.toMatchInlineSnapshot(
      `Use the --force flag to use the drop command in an unnattended environment like prisma drop --force --experimental`,
    )
    expect(
      ctx.mocked['console.error'].mock.calls.join('\n'),
    ).toMatchInlineSnapshot(``)
  })

  it('should work with --force', async () => {
    ctx.fixture('reset')
    const result = DbDrop.new().parse(['--force', '--experimental'])
    await expect(result).resolves.toMatchInlineSnapshot(`
            🚀  The SQLite database "dev.db" from "file:dev.db" was successfully dropped.

          `)
    expect(ctx.mocked['console.info'].mock.calls.join('\n'))
      .toMatchInlineSnapshot(`
      Prisma Schema loaded from prisma/schema.prisma

    `)
    expect(
      ctx.mocked['console.error'].mock.calls.join('\n'),
    ).toMatchInlineSnapshot(``)
  })

  it('should work with -f', async () => {
    ctx.fixture('reset')
    const result = DbDrop.new().parse(['--force', '--experimental'])
    await expect(result).resolves.toMatchInlineSnapshot(`
            🚀  The SQLite database "dev.db" from "file:dev.db" was successfully dropped.

          `)
    expect(ctx.mocked['console.info'].mock.calls.join('\n'))
      .toMatchInlineSnapshot(`
      Prisma Schema loaded from prisma/schema.prisma

    `)
    expect(
      ctx.mocked['console.error'].mock.calls.join('\n'),
    ).toMatchInlineSnapshot(``)
  })
})
