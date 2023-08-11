import { generateTestClient } from '../../../../utils/getTestClient'

test('blog-dot-env-both-conflict', async () => {
  const spy = jest.spyOn(console, 'warn').mockImplementation()

  await generateTestClient()
  require('./node_modules/@prisma/client')
  expect(spy.mock.calls.join('\n')).toMatchInlineSnapshot(`
    warn(prisma) Conflict for env var SQLITE_URL_FROM_DOT_ENV_FILE in src/__tests__/integration/happy/blog-dot-env-both-conflict/.env and src/__tests__/integration/happy/blog-dot-env-both-conflict/prisma/.env
    Env vars from src/__tests__/integration/happy/blog-dot-env-both-conflict/prisma/.env overwrite the ones from src/__tests__/integration/happy/blog-dot-env-both-conflict/.env
          
  `)
  spy.mockRestore()
})
