import { consoleContext, Context } from './__helpers__/context'

const ctx = Context.new().add(consoleContext()).assemble()

it('should read .env file in prisma folder when there is no schema', async () => {
  process.argv.push('--version')
  ctx.fixture('dotenv-4-prisma-no-schema')
  await import('../bin')
  expect(ctx.mocked['console.log'].mock.calls).toMatchSnapshot()
  expect(process.env.DOTENV_PRISMA_NO_SCHEMA_SHOULD_WORK).toEqual('file:dev.db')
  expect(process.env.DOTENV_ROOT_SHOULD_BE_UNDEFINED).toEqual(undefined)
})
