import path from 'path'
import assert from 'assert'
import stripAnsi from 'strip-ansi'

it('should read expanded env vars', async () => {
  process.argv.push('--version')

  const oldConsoleLog = console.error
  const logs: string[] = []
  console.error = (...args) => {
    logs.push(...args)
  }

  const cwd = process.cwd()
  process.chdir(path.join(__dirname, './fixtures/dotenv-6-expand'))
  process.argv.push('--schema=./expand/schema.prisma')
  await import('../bin')
  console.error = oldConsoleLog

  assert.equal(
    stripAnsi(logs.join()),
    'Environment variables loaded from provided --schema directory',
  )

  assert.equal(
    process.env.DOTENV_PRISMA_EXPAND_DATABASE_URL_WITH_SCHEMA,
    'postgres://user:password@server.host:5432/database?ssl=1&schema=schema1234',
    'process.env.DOTENV_PRISMA_EXPAND_DATABASE_URL_WITH_SCHEMA',
  )

  process.chdir(cwd)
})
