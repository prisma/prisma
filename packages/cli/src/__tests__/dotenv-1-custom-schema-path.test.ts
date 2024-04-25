import { jestContext, jestProcessContext } from '@prisma/get-platform'
import { loadEnvFile } from '@prisma/internals'

const ctx = jestContext.new().add(jestProcessContext()).assemble()

it('should read .env file in root folder and custom-path', () => {
  ctx.fixture('dotenv-1-custom-schema-path')

  loadEnvFile({ schemaPath: './custom-path/schema.prisma', printMessage: true })
  expect(ctx.mocked['process.stdout.write'].mock.calls.join('\n')).toMatchSnapshot()

  expect(process.env.DOTENV_PRISMA_WHEN_CUSTOM_SCHEMA_PATH_SHOULD_WORK).toEqual('file:dev.db')
  expect(process.env.DOTENV_ROOT).toEqual('shouldbebread')
  expect(process.env.DOTENV_PRISMA_WHEN_CUSTOM_SCHEMA_PATH_SHOULD_BE_UNDEFINED).toEqual(undefined)
})
