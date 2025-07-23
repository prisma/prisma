import { jestContext, jestStdoutContext } from '@prisma/get-platform'
import { loadEnvFile } from '@prisma/internals'
import { defaultTestConfig } from '@vetching-corporation/prisma-config'

const ctx = jestContext.new().add(jestStdoutContext()).assemble()

it('should not load root .env file', async () => {
  ctx.fixture('dotenv-5-only-root')

  await loadEnvFile({ printMessage: true, config: defaultTestConfig() })

  expect(ctx.mocked['process.stdout.write'].mock.calls.join('\n')).toMatchSnapshot()

  expect(process.env.DOTENV_ROOT_SHOULD_BE_UNDEFINED).toEqual(undefined)
})
