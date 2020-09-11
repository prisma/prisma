import { consoleContext, Context } from './__helpers__/context'

const ctx = Context.new().add(consoleContext()).assemble()

it('should NOT read .env file in root folder, only prisma/.env', async () => {
  ctx.fixture('dotenv-3-root-prisma-schema')
  process.argv.push('--version')
  await import('../bin')
  expect(ctx.mocked['console.error'].mock.calls).toMatchSnapshot()
  expect(process.env.DOTENV_ROOT_PRISMA_SHOULD_WORK).toEqual('file:dev.db')
  expect(process.env.DOTENV_PRISMA_SHOULD_BE_UNDEFINED).toEqual(undefined)
})
