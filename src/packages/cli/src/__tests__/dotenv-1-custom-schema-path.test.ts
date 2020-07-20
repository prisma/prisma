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
  process.chdir(path.join(__dirname, './fixtures/dotenv-1-custom-schema-path'))
  process.argv.push('--schema=./custom-path/schema.prisma')
  await import('../bin')
  console.error = oldConsoleLog

  assert.equal(
    stripAnsi(logs.join()),
    'Environment variables loaded from provided --schema directory',
  )

  assert.equal(
    process.env.DOTENV_PRISMA_WHEN_CUSTOM_SCHEMA_PATH_SHOULD_WORK,
    'file:dev.db',
    'process.env.DOTENV_PRISMA_WHEN_CUSTOM_SCHEMA_PATH_SHOULD_WORK',
  )

  assert.equal(
    process.env.DOTENV_ROOT_SHOULD_BE_UNDEFINED,
    undefined,
    'process.env.DOTENV_ROOT_SHOULD_BE_UNDEFINED',
  )

  assert.equal(
    process.env.DOTENV_PRISMA_WHEN_CUSTOM_SCHEMA_PATH_SHOULD_BE_UNDEFINED,
    undefined,
    'process.env.DOTENV_PRISMA_WHEN_CUSTOM_SCHEMA_PATH_SHOULD_BE_UNDEFINED',
  )

  process.chdir(cwd)
})
