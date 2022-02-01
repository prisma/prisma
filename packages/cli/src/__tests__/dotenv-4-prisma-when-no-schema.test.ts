import { jestConsoleContext, jestContext, loadEnvFile } from '@prisma/sdk'

const ctx = jestContext.new().add(jestConsoleContext()).assemble()

it('should read .env file in prisma folder when there is no schema', async () => {
  ctx.fixture('dotenv-4-prisma-no-schema')
  loadEnvFile()

  expect(ctx.mocked['console.info'].mock.calls.join('\n')).toMatchSnapshot()

  expect(process.env.DOTENV_PRISMA_NO_SCHEMA_SHOULD_WORK).toEqual('file:dev.db')
  expect(process.env.DOTENV_ROOT_SHOULD_BE_UNDEFINED).toEqual(undefined)
})
