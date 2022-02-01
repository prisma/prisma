import { jestConsoleContext, jestContext, loadEnvFile } from '@prisma/sdk'

const ctx = jestContext.new().add(jestConsoleContext()).assemble()

it('should not load root .env file', async () => {
  ctx.fixture('dotenv-5-only-root')
  loadEnvFile()

  expect(ctx.mocked['console.info'].mock.calls.join('\n')).toMatchSnapshot()

  expect(process.env.DOTENV_ROOT_SHOULD_BE_UNDEFINED).toEqual(undefined)
})
