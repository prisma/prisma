const navigator = { ...globalThis.navigator }

afterEach(() => {
  globalThis.navigator = navigator
})

test('proper error is shown when importing the browser build from cloudflare workers', async () => {
  globalThis.navigator = { userAgent: 'Cloudflare-Workers' } as any

  const { PrismaClient } = require('@prisma/client/index-browser')

  const prisma = new PrismaClient()

  let message = ''
  try {
    await prisma.user.findMany()
  } catch (e: any) {
    message = e.message
  }

  // TODO: re-enable wrangler when https://github.com/cloudflare/workers-sdk/issues/3631 is fixed
  // const message = await (await fetch('http://localhost:8787')).text()

  expect(message).toMatchInlineSnapshot(`
"PrismaClient is unable to run in Cloudflare Workers. As an alternative, try Accelerate: https://pris.ly/d/accelerate.
If this is unexpected, please open an issue: https://github.com/prisma/prisma/issues"
`)
})

export {}
