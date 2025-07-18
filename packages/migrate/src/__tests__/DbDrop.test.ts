import prompt from 'prompts'

import { DbDrop } from '../commands/DbDrop'
import { createDefaultTestContext } from './__helpers__/context'

const ctx = createDefaultTestContext()

describe('drop', () => {
  it('requires --preview-feature flag', async () => {
    ctx.fixture('empty')

    const result = DbDrop.new().parse([], await ctx.config())
    await expect(result).rejects.toThrowErrorMatchingInlineSnapshot(`
      "This feature is currently in Preview. There may be bugs and it's not recommended to use it in production environments.
      Please provide the --preview-feature flag to use this command."
    `)
  })

  it('should fail if no schema file', async () => {
    ctx.fixture('empty')

    const result = DbDrop.new().parse(['--preview-feature'], await ctx.config())
    await expect(result).rejects.toThrowErrorMatchingInlineSnapshot(`
      "Could not find Prisma Schema that is required for this command.
      You can either provide it with \`--schema\` argument,
      set it in your Prisma Config file (e.g., \`prisma.config.ts\`),
      set it as \`prisma.schema\` in your package.json,
      or put it into the default location (\`./prisma/schema.prisma\`, or \`./schema.prisma\`.
      Checked following paths:

      schema.prisma: file not found
      prisma/schema.prisma: file not found

      See also https://pris.ly/d/prisma-schema-location"
    `)
  })

  it('with missing db should fail (prompt)', async () => {
    ctx.fixture('reset')
    ctx.fs.remove('dev.db')

    prompt.inject(['y']) // simulate user yes input

    const result = DbDrop.new().parse(['--preview-feature'], await ctx.config())
    await expect(result).rejects.toMatchInlineSnapshot(`"The database name entered "y" doesn't match "dev.db"."`)
    expect(ctx.mocked['console.error'].mock.calls.join('\n')).toMatchInlineSnapshot(`""`)
  })

  it('with missing db should fail (--force)', async () => {
    ctx.fixture('reset')
    ctx.fs.remove('dev.db')

    const result = DbDrop.new().parse(['--preview-feature', '--force'], await ctx.config())
    // Schema engine error:
    // Failed to delete SQLite database at \`dev.db\`.
    // On Linux/macOS:
    // No such file or directory (os error 2)
    // On Windows:
    // No such file or directory (os error 2)
    await expect(result).rejects.toThrow(`Failed to delete SQLite database at \`../dev.db\`.`)
    expect(ctx.mocked['console.error'].mock.calls.join('\n')).toMatchInlineSnapshot(`""`)
  })

  it('should work (prompt)', async () => {
    ctx.fixture('reset')

    prompt.inject(['dev.db']) // simulate user input

    const result = DbDrop.new().parse(['--preview-feature'], await ctx.config())
    await expect(result).resolves.toContain(
      `The SQLite database "dev.db" from "file:../dev.db" was successfully dropped.`,
    )
    expect(ctx.normalizedCapturedStdout()).toMatchInlineSnapshot(`
      "Prisma schema loaded from prisma/schema.prisma
      Datasource "my_db": SQLite database "dev.db" <location placeholder>


      "
    `)
    expect(ctx.mocked['console.error'].mock.calls.join('\n')).toMatchInlineSnapshot(`""`)
  })

  it('should work (--force)', async () => {
    ctx.fixture('reset')

    const result = DbDrop.new().parse(['--preview-feature', '--force'], await ctx.config())
    await expect(result).resolves.toContain(
      `The SQLite database "dev.db" from "file:../dev.db" was successfully dropped.`,
    )
    expect(ctx.normalizedCapturedStdout()).toMatchInlineSnapshot(`
      "Prisma schema loaded from prisma/schema.prisma
      Datasource "my_db": SQLite database "dev.db" <location placeholder>

      "
    `)
    expect(ctx.mocked['console.error'].mock.calls.join('\n')).toMatchInlineSnapshot(`""`)
  })

  it('should work (-f)', async () => {
    ctx.fixture('reset')
    const result = DbDrop.new().parse(['--preview-feature', '-f'], await ctx.config())
    await expect(result).resolves.toContain(
      `The SQLite database "dev.db" from "file:../dev.db" was successfully dropped.`,
    )
    expect(ctx.normalizedCapturedStdout()).toMatchInlineSnapshot(`
      "Prisma schema loaded from prisma/schema.prisma
      Datasource "my_db": SQLite database "dev.db" <location placeholder>

      "
    `)
    expect(ctx.mocked['console.error'].mock.calls.join('\n')).toMatchInlineSnapshot(`""`)
  })

  it('should be cancelled (prompt)', async () => {
    ctx.fixture('reset')
    const mockExit = jest.spyOn(process, 'exit').mockImplementation((number) => {
      throw new Error('process.exit: ' + number)
    })

    prompt.inject([new Error()]) // simulate cancel

    const result = DbDrop.new().parse(['--preview-feature'], await ctx.config())
    await expect(result).rejects.toMatchInlineSnapshot(`"process.exit: 130"`)
    expect(ctx.normalizedCapturedStdout()).toMatchInlineSnapshot(`
      "Prisma schema loaded from prisma/schema.prisma
      Datasource "my_db": SQLite database "dev.db" <location placeholder>


      Drop cancelled.
      "
    `)
    expect(ctx.mocked['console.error'].mock.calls.join('\n')).toMatchInlineSnapshot(`""`)
    expect(mockExit).toHaveBeenCalledWith(130)
  })

  it('should ask for --force if not provided if CI', async () => {
    ctx.fixture('reset')
    process.env.GITHUB_ACTIONS = '1'

    const result = DbDrop.new().parse(['--preview-feature'], await ctx.config())
    await expect(result).rejects.toMatchInlineSnapshot(
      `"Use the --force flag to use the drop command in an unattended environment like prisma db drop --force --preview-feature"`,
    )
    expect(ctx.mocked['console.error'].mock.calls.join('\n')).toMatchInlineSnapshot(`""`)
  })
})
