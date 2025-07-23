import { jestContext, jestStdoutContext } from '@prisma/get-platform'
import { loadEnvFile } from '@prisma/internals'
import { defaultTestConfig } from '@vetching-corporation/prisma-config'

const ctx = jestContext.new().add(jestStdoutContext()).assemble()

it('should read .env file in root folder and custom-path', async () => {
  ctx.fixture('dotenv-1-custom-schema-path')

  await loadEnvFile({ schemaPath: './custom-path/schema.prisma', printMessage: true, config: defaultTestConfig() })
  expect(ctx.mocked['process.stdout.write'].mock.calls.join('\n')).toMatchSnapshot()

  expect(process.env.DOTENV_PRISMA_WHEN_CUSTOM_SCHEMA_PATH_SHOULD_WORK).toEqual('file:dev.db')
  expect(process.env.DOTENV_ROOT).toEqual('shouldbebread')
  expect(process.env.DOTENV_PRISMA_WHEN_CUSTOM_SCHEMA_PATH_SHOULD_BE_UNDEFINED).toEqual(undefined)
})
