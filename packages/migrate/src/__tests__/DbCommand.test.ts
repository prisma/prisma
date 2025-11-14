import { DbCommand } from '../commands/DbCommand'
import { createDefaultTestContext } from './__helpers__/context'

const ctx = createDefaultTestContext()
it('no params should return help', async () => {
  const commandInstance = DbCommand.new({})
  const spy = jest.spyOn(commandInstance, 'help').mockImplementation(() => 'Help Me')

  await commandInstance.parse([], await ctx.config(), ctx.configDir())
  expect(spy).toHaveBeenCalledTimes(1)
  spy.mockRestore()
})

it('wrong flag', async () => {
  const commandInstance = DbCommand.new({})
  const spy = jest.spyOn(commandInstance, 'help').mockImplementation(() => 'Help Me')

  await commandInstance.parse(['--something'], await ctx.config(), ctx.configDir())
  expect(spy).toHaveBeenCalledTimes(1)
  spy.mockRestore()
})

it('help flag', async () => {
  const commandInstance = DbCommand.new({})
  const spy = jest.spyOn(commandInstance, 'help').mockImplementation(() => 'Help Me')

  await commandInstance.parse(['--help'], await ctx.config(), ctx.configDir())
  expect(spy).toHaveBeenCalledTimes(1)
  spy.mockRestore()
})

it('unknown command', async () => {
  await expect(DbCommand.new({}).parse(['doesnotexist'], await ctx.config(), ctx.configDir())).resolves.toThrow()
})
