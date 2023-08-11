import { jestConsoleContext, jestContext } from '@prisma/get-platform'
import { loadEnvFile } from '@prisma/internals'

const ctx = jestContext.new().add(jestConsoleContext()).assemble()

it('should read .env file in prisma folder', () => {
  ctx.fixture('dotenv-2-prisma-folder')
  loadEnvFile(undefined, true)

  expect(ctx.mocked['console.info'].mock.calls.join('\n')).toMatchSnapshot()

  expect(process.env.DOTENV_PRISMA_SHOULD_WORK).toEqual('file:dev.db')
  expect(process.env.DOTENV_ROOT_SHOULD_BE_UNDEFINED).toEqual(undefined)
})
