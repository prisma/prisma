test('proper error is shown when the client is bundled into a frontend', async () => {
  const message = await require('../dist/index.js').call()

  expect(message).toMatchInlineSnapshot(`
"PrismaClient is unable to run in this browser environment, or has been bundled for the browser (running in \`node\`).
If this is unexpected, please open an issue: https://github.com/prisma/prisma/issues"
`)
})

export {}
