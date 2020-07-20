import path from 'path'
import assert from 'assert'
import stripAnsi from 'strip-ansi'

it('should read .env file in prisma folder', async () => {
  process.argv.push('--version')

  const oldConsoleLog = console.error
  const logs: string[] = []
  console.error = (...args) => {
    logs.push(...args)
  }

  const cwd = process.cwd()
  process.chdir(path.join(__dirname, './fixtures/dotenv-2-prisma-folder'))
  await import('../bin')

  console.error = oldConsoleLog
  assert.equal(
    stripAnsi(logs.join()),
    'Environment variables loaded from prisma/.env',
  )

  assert.equal(process.env.DOTENV_PRISMA_SHOULD_WORK, 'file:dev.db')

  assert.equal(
    process.env.DOTENV_ROOT_SHOULD_BE_UNDEFINED,
    undefined,
    'process.env.DOTENV_ROOT_SHOULD_BE_UNDEFINED',
  )

  process.chdir(cwd)
})
