import { MigrateCommand } from '../commands/MigrateCommand'

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
  await expect(MigrateCommand.new({}).parse(['doesnotexist'])).resolves.toThrow()
})
