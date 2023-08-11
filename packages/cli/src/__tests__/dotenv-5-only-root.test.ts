import { jestConsoleContext, jestContext } from '@prisma/get-platform'
import { loadEnvFile } from '@prisma/internals'

const ctx = jestContext.new().add(jestConsoleContext()).assemble()

it('should not load root .env file', () => {
  ctx.fixture('dotenv-5-only-root')
  loadEnvFile(undefined, true)

  expect(ctx.mocked['console.info'].mock.calls.join('\n')).toMatchSnapshot()

  expect(process.env.DOTENV_ROOT_SHOULD_BE_UNDEFINED).toEqual(undefined)
})
