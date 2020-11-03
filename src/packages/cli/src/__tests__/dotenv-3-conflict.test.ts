import { consoleContext, Context } from './__helpers__/context'

const ctx = Context.new().add(consoleContext()).assemble()

it('should throw error', async () => {
  ctx.fixture('dotenv-3-conflict')
  expect.assertions(1)
  process.argv.push('--version')
  try {
    await import('../bin')
  } catch (e) {
    expect(e).toMatchSnapshot()
  }
})
