import { MigrateCommand } from '../commands/MigrateCommand'

it('no params should return help', async () => {
  const commandInstance = MigrateCommand.new({})
  let spy = jest
    .spyOn(commandInstance, 'help')
    .mockImplementation(() => 'Help Me')

  await expect(commandInstance.parse([])).resolves

  expect(spy).toHaveBeenCalledTimes(1)

  spy.mockRestore()
})

it('unknown command', async () => {
  await expect(
    MigrateCommand.new({}).parse(['doesnotexist']),
  ).resolves.toThrowError()
})

describe('legacy', () => {
  it('up command', async () => {
    await expect(MigrateCommand.new({}).parse(['up'])).rejects
      .toMatchInlineSnapshot(`
            The current command "up" doesn't exist in the new version of Prisma Migrate.
            Read more about how to upgrade: https://pris.ly/d/migrate-upgrade
          `)
  })

  it('down command', async () => {
    await expect(MigrateCommand.new({}).parse(['down'])).rejects
      .toMatchInlineSnapshot(`
            The current command "down" doesn't exist in the new version of Prisma Migrate.
            Read more about how to upgrade: https://pris.ly/d/migrate-upgrade
          `)
  })

  it('save command', async () => {
    await expect(MigrateCommand.new({}).parse(['save'])).rejects
      .toMatchInlineSnapshot(`
            The current command "save" doesn't exist in the new version of Prisma Migrate.
            Read more about how to upgrade: https://pris.ly/d/migrate-upgrade
          `)
  })
})
