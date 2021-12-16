import { consoleContext, Context } from './__helpers__/context'

const ctx = Context.new().add(consoleContext()).assemble()

it('should not load root .env file', async () => {
  process.argv.push('--version')
  ctx.fixture('dotenv-5-only-root')
  await import('../bin')
  expect(ctx.mocked['console.log'].mock.calls.join('\n')).toMatchSnapshot()
  expect(process.env.DOTENV_ROOT_SHOULD_BE_UNDEFINED).toEqual(undefined)
})
