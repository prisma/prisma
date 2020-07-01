import path from 'path'
import assert from 'assert'

it('should read .env files, even if theres no schema.prisma next to it', async () => {
  process.argv.push('--version')
  const cwd = process.cwd()
  process.chdir(path.join(__dirname, './fixtures/env-var-test'))
  await import('../bin')
  process.chdir(cwd)

  assert.equal(process.env.MY_ENV_VAR, 'hello')
})
