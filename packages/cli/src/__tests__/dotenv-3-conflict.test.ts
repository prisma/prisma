import { jestConsoleContext, jestContext, loadEnvFile } from '@prisma/sdk'

const ctx = jestContext.new().add(jestConsoleContext()).assemble()

it('should throw error', () => {
  const spy = jest.spyOn(console, 'warn').mockImplementation()
  ctx.fixture('dotenv-3-conflict')
  loadEnvFile(undefined, true)

  expect(spy.mock.calls.join('\n')).toMatchInlineSnapshot(`
  warn(prisma) Conflict for env var TEST_ENV in .env and prisma/.env
  Env vars from prisma/.env overwrite the ones from .env
        
`)

  expect(process.env.TEST_ENV).toEqual('shouldbebread')
})
