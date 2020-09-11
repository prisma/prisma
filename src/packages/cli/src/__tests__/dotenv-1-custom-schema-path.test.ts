import { consoleContext, Context } from './__helpers__/context'

const ctx = Context.new().add(consoleContext()).assemble()

it('should NOT read .env file in root folder, only prisma/.env', async () => {
  process.argv.push('--version')
  process.argv.push('--schema=./custom-path/schema.prisma')
  ctx.fixture('dotenv-1-custom-schema-path')
  await import('../bin')
  expect(ctx.mocked['console.error'].mock.calls).toMatchSnapshot()
  expect(process.env.DOTENV_PRISMA_WHEN_CUSTOM_SCHEMA_PATH_SHOULD_WORK).toEqual(
    'file:dev.db',
  )
  expect(process.env.DOTENV_ROOT_SHOULD_BE_UNDEFINED).toEqual(undefined)
  expect(
    process.env.DOTENV_PRISMA_WHEN_CUSTOM_SCHEMA_PATH_SHOULD_BE_UNDEFINED,
  ).toEqual(undefined)
})
