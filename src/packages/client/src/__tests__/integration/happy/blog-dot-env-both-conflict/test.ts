import { generateTestClient } from '../../../../utils/getTestClient'

test('blog-dot-env-both-conflict', async () => {
  const spy = jest.spyOn(console, 'warn').mockImplementation()

  await generateTestClient()
  require('./node_modules/@prisma/client')
  expect(spy.mock.calls.join('\n')).toMatchInlineSnapshot(`
    warn(prisma) Conflict for env var SQLITE_URL_FROM_DOT_ENV_FILE in .env and prisma/.env
    Env vars from prisma/.env overwrite the ones from .env
          
  `)
  spy.mockRestore()
})
