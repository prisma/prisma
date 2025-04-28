import { jestConsoleContext, jestContext } from '@prisma/get-platform'

import { MigrateCommand } from '../commands/MigrateCommand'
import { configContextContributor } from './__helpers__/prismaConfig'

const ctx = jestContext.new().add(jestConsoleContext()).add(configContextContributor()).assemble()

it('no params should return help', async () => {
  const commandInstance = MigrateCommand.new({})
  const spy = jest.spyOn(commandInstance, 'help').mockImplementation(() => 'Help Me')

  await commandInstance.parse([], ctx.config)
  expect(spy).toHaveBeenCalledTimes(1)
  spy.mockRestore()
})

it('wrong flag', async () => {
  const commandInstance = MigrateCommand.new({})
  const spy = jest.spyOn(commandInstance, 'help').mockImplementation(() => 'Help Me')

  await commandInstance.parse(['--something'], ctx.config)
  expect(spy).toHaveBeenCalledTimes(1)
  spy.mockRestore()
})

it('help flag', async () => {
  const commandInstance = MigrateCommand.new({})
  const spy = jest.spyOn(commandInstance, 'help').mockImplementation(() => 'Help Me')

  await commandInstance.parse(['--help'], ctx.config)
  expect(spy).toHaveBeenCalledTimes(1)
  spy.mockRestore()
})

it('unknown command', async () => {
  await expect(MigrateCommand.new({}).parse(['doesnotexist'], ctx.config)).resolves.toThrow()
})
