import { MigrateCommand } from '../commands/MigrateCommand'
import { MigrateDev } from '../commands/MigrateDev'

it('no params should return help', async () => {
  const commandInstance = MigrateCommand.new({})
  const spy = jest.spyOn(commandInstance, 'help').mockImplementation(() => 'Help Me')

  await commandInstance.parse([])
  expect(spy).toHaveBeenCalledTimes(1)
  spy.mockRestore()
})

it('wrong flag', async () => {
  const commandInstance = MigrateCommand.new({})
  const spy = jest.spyOn(commandInstance, 'help').mockImplementation(() => 'Help Me')

  await commandInstance.parse(['--something'])
  expect(spy).toHaveBeenCalledTimes(1)
  spy.mockRestore()
})

it('help flag', async () => {
  const commandInstance = MigrateCommand.new({})
  const spy = jest.spyOn(commandInstance, 'help').mockImplementation(() => 'Help Me')

  await commandInstance.parse(['--help'])
  expect(spy).toHaveBeenCalledTimes(1)
  spy.mockRestore()
})

it('unknown command', async () => {
  await expect(MigrateCommand.new({}).parse(['doesnotexist'])).resolves.toThrowError()
})

it('dev with --preview-feature flag', async () => {
  await expect(
    MigrateCommand.new({
      dev: MigrateDev.new(),
    }).parse(['dev', '--preview-feature']),
  ).rejects.toMatchInlineSnapshot(`
          Could not find a schema.prisma file that is required for this command.
          You can either provide it with --schema, set it as \`schema.prisma\` in your package.json or put it into the default location ./prisma/schema.prisma https://pris.ly/d/prisma-schema-location
        `)
})

describe('legacy', () => {
  it('experimental flag', async () => {
    await expect(MigrateCommand.new({}).parse(['--experimental'])).rejects.toMatchInlineSnapshot(`
            Prisma Migrate was Experimental and is now Generally Available.
            WARNING this new version has some breaking changes to use it it's recommended to read the documentation first and remove the --experimental flag.
          `)
  })

  it('up command', async () => {
    await expect(MigrateCommand.new({}).parse(['up'])).rejects.toMatchInlineSnapshot(`
            The current command "up" doesn't exist in the new version of Prisma Migrate.
            Read more about how to upgrade: https://pris.ly/d/migrate-upgrade
          `)
  })

  it('down command', async () => {
    await expect(MigrateCommand.new({}).parse(['down'])).rejects.toMatchInlineSnapshot(`
            The current command "down" doesn't exist in the new version of Prisma Migrate.
            Read more about how to upgrade: https://pris.ly/d/migrate-upgrade
          `)
  })

  it('save command', async () => {
    await expect(MigrateCommand.new({}).parse(['save'])).rejects.toMatchInlineSnapshot(`
            The current command "save" doesn't exist in the new version of Prisma Migrate.
            Read more about how to upgrade: https://pris.ly/d/migrate-upgrade
          `)
  })
})
