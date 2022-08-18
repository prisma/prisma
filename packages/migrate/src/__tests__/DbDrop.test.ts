import { jestConsoleContext, jestContext } from '@prisma/internals'
import prompt from 'prompts'

import { DbDrop } from '../commands/DbDrop'

// TODO: Windows: snapshot tests fail on Windows because of emoji and different error messages.
const describeIf = (condition: boolean) => (condition ? describe : describe.skip)

const ctx = jestContext.new().add(jestConsoleContext()).assemble()

describeIf(process.platform !== 'win32')('drop', () => {
  it('requires --preview-feature flag', async () => {
    ctx.fixture('empty')

    const result = DbDrop.new().parse([])
    await expect(result).rejects.toThrowErrorMatchingInlineSnapshot(`
            This feature is currently in Preview. There may be bugs and it's not recommended to use it in production environments.
            Please provide the --preview-feature flag to use this command.
          `)
  })

  it('should fail if no schema file', async () => {
    ctx.fixture('empty')

    const result = DbDrop.new().parse(['--preview-feature'])
    await expect(result).rejects.toThrowErrorMatchingInlineSnapshot(`
                      Could not find a schema.prisma file that is required for this command.
                      You can either provide it with --schema, set it as \`prisma.schema\` in your package.json or put it into the default location ./prisma/schema.prisma https://pris.ly/d/prisma-schema-location
                  `)
  })

  it('with missing db should fail (prompt)', async () => {
    ctx.fixture('reset')
    ctx.fs.remove('prisma/dev.db')

    prompt.inject(['y']) // simulate user yes input

    const result = DbDrop.new().parse(['--preview-feature'])
    await expect(result).rejects.toMatchInlineSnapshot(`The database name entered "y" doesn't match "dev.db".`)
    expect(ctx.mocked['console.error'].mock.calls.join('\n')).toMatchInlineSnapshot(``)
  })

  it('with missing db should fail (--force)', async () => {
    ctx.fixture('reset')
    ctx.fs.remove('prisma/dev.db')

    const result = DbDrop.new().parse(['--preview-feature', '--force'])
    await expect(result).rejects.toMatchInlineSnapshot(`
      Migration engine error:
      Failed to delete SQLite database at \`dev.db\`.
      No such file or directory (os error 2)

    `)
    expect(ctx.mocked['console.error'].mock.calls.join('\n')).toMatchInlineSnapshot(``)
  })

  it('should work (prompt)', async () => {
    ctx.fixture('reset')

    prompt.inject(['dev.db']) // simulate user input

    const result = DbDrop.new().parse(['--preview-feature'])
    await expect(result).resolves.toMatchInlineSnapshot(`
            🚀  The SQLite database "dev.db" from "file:dev.db" was successfully dropped.

          `)
    expect(ctx.mocked['console.info'].mock.calls.join('\n')).toMatchInlineSnapshot(`
      Prisma schema loaded from prisma/schema.prisma
      Datasource "my_db": SQLite database "dev.db" at "file:dev.db"


    `)
    expect(ctx.mocked['console.error'].mock.calls.join('\n')).toMatchInlineSnapshot(``)
  })

  it('should work (--force)', async () => {
    ctx.fixture('reset')

    const result = DbDrop.new().parse(['--preview-feature', '--force'])
    await expect(result).resolves.toMatchInlineSnapshot(`
            🚀  The SQLite database "dev.db" from "file:dev.db" was successfully dropped.

          `)
    expect(ctx.mocked['console.info'].mock.calls.join('\n')).toMatchInlineSnapshot(`
      Prisma schema loaded from prisma/schema.prisma
      Datasource "my_db": SQLite database "dev.db" at "file:dev.db"

    `)
    expect(ctx.mocked['console.error'].mock.calls.join('\n')).toMatchInlineSnapshot(``)
  })

  it('should work (-f)', async () => {
    ctx.fixture('reset')
    const result = DbDrop.new().parse(['--preview-feature', '-f'])
    await expect(result).resolves.toMatchInlineSnapshot(`
            🚀  The SQLite database "dev.db" from "file:dev.db" was successfully dropped.

          `)
    expect(ctx.mocked['console.info'].mock.calls.join('\n')).toMatchInlineSnapshot(`
      Prisma schema loaded from prisma/schema.prisma
      Datasource "my_db": SQLite database "dev.db" at "file:dev.db"

    `)
    expect(ctx.mocked['console.error'].mock.calls.join('\n')).toMatchInlineSnapshot(``)
  })

  it('should be cancelled (prompt)', async () => {
    ctx.fixture('reset')
    const mockExit = jest.spyOn(process, 'exit').mockImplementation((number) => {
      throw new Error('process.exit: ' + number)
    })

    prompt.inject([new Error()]) // simulate cancel

    const result = DbDrop.new().parse(['--preview-feature'])
    await expect(result).rejects.toMatchInlineSnapshot(`process.exit: 0`)
    expect(ctx.mocked['console.info'].mock.calls.join('\n')).toMatchInlineSnapshot(`
      Prisma schema loaded from prisma/schema.prisma
      Datasource "my_db": SQLite database "dev.db" at "file:dev.db"


      Drop cancelled.
    `)
    expect(ctx.mocked['console.error'].mock.calls.join('\n')).toMatchInlineSnapshot(``)
    expect(mockExit).toBeCalledWith(0)
  })

  it('should ask for --force if not provided if CI', async () => {
    ctx.fixture('reset')
    process.env.GITHUB_ACTIONS = '1'

    const result = DbDrop.new().parse(['--preview-feature'])
    await expect(result).rejects.toMatchInlineSnapshot(
      `Use the --force flag to use the drop command in an unnattended environment like prisma db drop --force --preview-feature`,
    )
    expect(ctx.mocked['console.error'].mock.calls.join('\n')).toMatchInlineSnapshot(``)
  })
})
