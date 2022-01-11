import { jestConsoleContext, jestContext } from '@prisma/sdk'

const ctx = jestContext.new().add(jestConsoleContext()).assemble()

it('should read .env file in root folder and custom-path', async () => {
  process.argv.push('--version')
  process.argv.push('--schema=./custom-path/schema.prisma')
  ctx.fixture('dotenv-1-custom-schema-path')
  await import('../bin')
  expect(ctx.mocked['console.log'].mock.calls.join('\n')).toMatchSnapshot()

  expect(process.env.DOTENV_PRISMA_WHEN_CUSTOM_SCHEMA_PATH_SHOULD_WORK).toEqual('file:dev.db')
  expect(process.env.DOTENV_ROOT).toEqual('shouldbebread')
  expect(process.env.DOTENV_PRISMA_WHEN_CUSTOM_SCHEMA_PATH_SHOULD_BE_UNDEFINED).toEqual(undefined)
})
