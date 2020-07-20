import path from 'path'
import assert from 'assert'
import stripAnsi from 'strip-ansi'

it('should not load root .env file', async () => {
  process.argv.push('--version')

  const oldConsoleLog = console.error
  const logs: string[] = []
  console.error = (...args) => {
    logs.push(...args)
  }

  const cwd = process.cwd()
  process.chdir(path.join(__dirname, './fixtures/dotenv-5-not-loaded'))
  await import('../bin')

  console.error = oldConsoleLog
  assert.equal(stripAnsi(logs.join()), '')

  assert.equal(
    process.env.DOTENV_ROOT_SHOULD_BE_UNDEFINED,
    undefined,
    'process.env.DOTENV_ROOT_SHOULD_BE_UNDEFINED',
  )

  process.chdir(cwd)
})
