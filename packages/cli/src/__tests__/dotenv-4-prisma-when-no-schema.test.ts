import { jestContext, jestStdoutContext } from '@prisma/get-platform'
import { loadEnvFile } from '@prisma/internals'
import { defaultTestConfig } from '@vetching-corporation/prisma-config'

const ctx = jestContext.new().add(jestStdoutContext()).assemble()

it('should read .env file in prisma folder when there is no schema', async () => {
  ctx.fixture('dotenv-4-prisma-no-schema')

  await loadEnvFile({ printMessage: true, config: defaultTestConfig() })

  expect(ctx.mocked['process.stdout.write'].mock.calls.join('\n')).toMatchSnapshot()

  expect(process.env.DOTENV_PRISMA_NO_SCHEMA_SHOULD_WORK).toEqual('file:dev.db')
  expect(process.env.DOTENV_ROOT_SHOULD_BE_UNDEFINED).toEqual(undefined)
})
