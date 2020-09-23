import { MigrateCommand } from '../commands/MigrateCommand'
import { consoleContext, Context } from './__helpers__/context'

const ctx = Context.new().add(consoleContext()).assemble()

// That should fail?
it('migrate in folder with schema only', async () => {
  ctx.fixture('init')
  const result = MigrateCommand.new().parse(['--experimental'])
  await expect(result).resolves.toMatchInlineSnapshot(`Reset successful.`)
  expect(
    ctx.mocked['console.error'].mock.calls.join('\n'),
  ).toMatchInlineSnapshot(``)
})

it('migrate should fail if no schema file', async () => {
  ctx.fixture('empty')
  const result = MigrateCommand.new().parse(['--experimental'])
  await expect(result).rejects.toThrowErrorMatchingInlineSnapshot(`
          Could not find a schema.prisma file that is required for this command.
          You can either provide it with --schema, set it as \`prisma.schema\` in your package.json or put it into the default location ./prisma/schema.prisma https://pris.ly/d/prisma-schema-location
        `)
})

it('migrate should', async () => {
  ctx.fixture('reset')
  const result = MigrateCommand.new().parse(['--experimental'])
  await expect(result).resolves.toMatchInlineSnapshot(`Reset successful.`)
  expect(
    ctx.mocked['console.error'].mock.calls.join('\n'),
  ).toMatchInlineSnapshot(``)
})
