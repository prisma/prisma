import { jestConsoleContext, jestContext } from '@prisma/get-platform'
import { loadEnvFile } from '@prisma/internals'

const ctx = jestContext.new().add(jestConsoleContext()).assemble()

it('should read .env file in root folder and custom-path', () => {
  ctx.fixture('dotenv-1-custom-schema-path')
  loadEnvFile('./custom-path/schema.prisma', true)
  expect(ctx.mocked['console.info'].mock.calls.join('\n')).toMatchSnapshot()

  expect(process.env.DOTENV_PRISMA_WHEN_CUSTOM_SCHEMA_PATH_SHOULD_WORK).toEqual('file:dev.db')
  expect(process.env.DOTENV_ROOT).toEqual('shouldbebread')
  expect(process.env.DOTENV_PRISMA_WHEN_CUSTOM_SCHEMA_PATH_SHOULD_BE_UNDEFINED).toEqual(undefined)
})
