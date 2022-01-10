import { jestConsoleContext, jestContext } from '@prisma/sdk'

const ctx = jestContext.new().add(jestConsoleContext()).assemble()

it('should read .env file in prisma folder', async () => {
  process.argv.push('--version')
  ctx.fixture('dotenv-2-prisma-folder')
  await import('../bin')
  expect(ctx.mocked['console.log'].mock.calls.join('\n')).toMatchSnapshot()
  expect(process.env.DOTENV_PRISMA_SHOULD_WORK).toEqual('file:dev.db')
  expect(process.env.DOTENV_ROOT_SHOULD_BE_UNDEFINED).toEqual(undefined)
})
