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
                      The current command "up" doesn't exist on the latest version of Prisma Migrate.
                      You can find the documentation for how to upgrade here: TODO
                  `)
  })

  it('down command', async () => {
    await expect(MigrateCommand.new({}).parse(['down'])).rejects
      .toMatchInlineSnapshot(`
            The current command "down" doesn't exist on the latest version of Prisma Migrate.
            You can find the documentation for how to upgrade here: TODO
          `)
  })

  it('save command', async () => {
    await expect(MigrateCommand.new({}).parse(['save'])).rejects
      .toMatchInlineSnapshot(`
            The current command "save" doesn't exist on the latest version of Prisma Migrate.
            You can find the documentation for how to upgrade here: TODO
          `)
  })
})
