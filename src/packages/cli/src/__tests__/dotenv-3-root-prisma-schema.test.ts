import path from 'path'
import assert from 'assert'
import stripAnsi from 'strip-ansi'

it('should NOT read .env file in root folder, only prisma/.env', async () => {
  process.argv.push('--version')

  const oldConsoleLog = console.error
  const logs: string[] = []
  console.error = (...args) => {
    logs.push(...args)
  }

  const cwd = process.cwd()
  process.chdir(path.join(__dirname, './fixtures/dotenv-3-root-prisma-schema'))
  await import('../bin')
  console.error = oldConsoleLog
  assert.equal(
    stripAnsi(logs.join()),
    'Environment variables loaded from current directory',
  )

  assert.equal(
    process.env.DOTENV_ROOT_PRISMA_SHOULD_WORK,
    'file:dev.db',
    'process.env.DOTENV_ROOT_PRISMA_SHOULD_WORK',
  )

  assert.equal(
    process.env.DOTENV_PRISMA_SHOULD_BE_UNDEFINED,
    undefined,
    'process.env.DOTENV_PRISMA_SHOULD_BE_UNDEFINED',
  )

  process.chdir(cwd)
})
