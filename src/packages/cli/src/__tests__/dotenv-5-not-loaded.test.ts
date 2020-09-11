import { consoleContext, Context } from './__helpers__/context'

const ctx = Context.new().add(consoleContext()).assemble()

it('should not load root .env file', async () => {
  process.argv.push('--version')
  ctx.fixture('dotenv-5-not-loaded')
  await import('../bin')
  expect(ctx.mocked['console.error'].mock.calls).toMatchSnapshot()
  expect(process.env.DOTENV_ROOT_SHOULD_BE_UNDEFINED).toEqual(undefined)
})
