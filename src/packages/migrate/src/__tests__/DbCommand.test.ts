import { DbCommand } from '../commands/DbCommand'
import { DbSeed } from '../commands/DbSeed'

it('no params should return help', async () => {
  const commandInstance = DbCommand.new({})
  const spy = jest
    .spyOn(commandInstance, 'help')
    .mockImplementation(() => 'Help Me')

  await commandInstance.parse([])
  expect(spy).toHaveBeenCalledTimes(1)
  spy.mockRestore()
})

it('wrong flag', async () => {
  const commandInstance = DbCommand.new({})
  const spy = jest
    .spyOn(commandInstance, 'help')
    .mockImplementation(() => 'Help Me')

  await commandInstance.parse(['--something'])
  expect(spy).toHaveBeenCalledTimes(1)
  spy.mockRestore()
})

it('help flag', async () => {
  const commandInstance = DbCommand.new({})
  const spy = jest
    .spyOn(commandInstance, 'help')
    .mockImplementation(() => 'Help Me')

  await commandInstance.parse(['--help'])
  expect(spy).toHaveBeenCalledTimes(1)
  spy.mockRestore()
})

it('unknown command', async () => {
  await expect(
    DbCommand.new({}).parse(['doesnotexist']),
  ).resolves.toThrowError()
})

it('db seed with --preview-feature flag', async () => {
  await expect(
    DbCommand.new({
      dev: DbSeed.new(),
    }).parse(['dev', '--preview-feature']),
  ).rejects.toMatchInlineSnapshot(`
          Could not find a schema.prisma file that is required for this command.
          You can either provide it with --schema, set it as \`prisma.schema\` in your package.json or put it into the default location ./prisma/schema.prisma https://pris.ly/d/prisma-schema-location
        `)
})

it('db seed without --preview-feature flag', async () => {
  await expect(
    DbCommand.new({
      dev: DbSeed.new(),
    }).parse(['dev']),
  ).rejects.toMatchInlineSnapshot(`
          This feature is currently in Preview. There may be bugs and it's not recommended to use it in production environments.
          Please provide the --preview-feature flag to use this command.
        `)
})
