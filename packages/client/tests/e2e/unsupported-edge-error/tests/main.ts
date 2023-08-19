test('proper error is shown when importing the browser build from cloudflare workers', async () => {
  const message = await (await fetch('http://localhost:8787')).text()

  expect(message).toMatchInlineSnapshot(`
"PrismaClient is unable to run in Cloudflare Workers. As an alternative, try Accelerate: https://pris.ly/d/accelerate.
If this is unexpected, please open an issue: https://github.com/prisma/prisma/issues"
`)
})

export {}
