import { DbCommand } from '../commands/DbCommand'
import { DbPush } from '../commands/DbPush'

it('no params should return help', async () => {
  const commandInstance = DbCommand.new({})
  let spy = jest
    .spyOn(commandInstance, 'help')
    .mockImplementation(() => 'Help Me')

  await expect(commandInstance.parse([])).resolves

  expect(spy).toHaveBeenCalledTimes(1)

  spy.mockRestore()
})

it('wrong flag', async () => {
  const commandInstance = DbCommand.new({})
  let spy = jest
    .spyOn(commandInstance, 'help')
    .mockImplementation(() => 'Help Me')

  await expect(commandInstance.parse(['--something'])).resolves
  expect(spy).toHaveBeenCalledTimes(1)
  spy.mockRestore()
})

it('help flag', async () => {
  const commandInstance = DbCommand.new({})
  let spy = jest
    .spyOn(commandInstance, 'help')
    .mockImplementation(() => 'Help Me')

  await expect(commandInstance.parse(['--help'])).resolves
  expect(spy).toHaveBeenCalledTimes(1)
  spy.mockRestore()
})

it('unknown command', async () => {
  await expect(
    DbCommand.new({}).parse(['doesnotexist']),
  ).resolves.toThrowError()
})

it('dev with --preview-feature flag', async () => {
  await expect(
    DbCommand.new({
      dev: DbPush.new(),
    }).parse(['dev', '--preview-feature']),
  ).rejects.toMatchInlineSnapshot(`
          Could not find a schema.prisma file that is required for this command.
          You can either provide it with --schema, set it as \`prisma.schema\` in your package.json or put it into the default location ./prisma/schema.prisma https://pris.ly/d/prisma-schema-location
        `)
})

it('dev without --preview-feature flag', async () => {
  await expect(
    DbCommand.new({
      dev: DbPush.new(),
    }).parse(['dev']),
  ).rejects.toMatchInlineSnapshot(`
          This feature is currently in Preview. There may be bugs and it's not recommended to use it in production environments.
          Please provide the --preview-feature flag to use this command.
        `)
})

describe('legacy', () => {
  it('experimental flag', async () => {
    await expect(DbCommand.new({}).parse(['--experimental'])).rejects
      .toMatchInlineSnapshot(`
            Prisma Migrate was Experimental and is now in Preview.
            WARNING this new iteration has some breaking changes to use it it's recommended to read the documentation first and replace the --experimental flag with --preview-feature.
          `)
  })

  it('up command', async () => {
    await expect(DbCommand.new({}).parse(['up'])).rejects
      .toMatchInlineSnapshot(`
            The current command "up" doesn't exist in the new version of Prisma Migrate.
            Read more about how to upgrade: https://pris.ly/d/migrate-upgrade
          `)
  })

  it('down command', async () => {
    await expect(DbCommand.new({}).parse(['down'])).rejects
      .toMatchInlineSnapshot(`
            The current command "down" doesn't exist in the new version of Prisma Migrate.
            Read more about how to upgrade: https://pris.ly/d/migrate-upgrade
          `)
  })

  it('save command', async () => {
    await expect(DbCommand.new({}).parse(['save'])).rejects
      .toMatchInlineSnapshot(`
            The current command "save" doesn't exist in the new version of Prisma Migrate.
            Read more about how to upgrade: https://pris.ly/d/migrate-upgrade
          `)
  })
})
