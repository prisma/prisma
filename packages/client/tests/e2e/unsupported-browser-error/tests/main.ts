test('proper error is shown when the client is bundled into a frontend', async () => {
  const message = await require('../dist/new-client.js').call()

  expect(message).toMatchInlineSnapshot(`
"PrismaClient is unable to run in this browser environment, or has been bundled for the browser (running in \`Node.js\`).
If this is unexpected, please open an issue: https://pris.ly/prisma-prisma-bug-report"
`)
})

test('no error is shown when enum is imported into a frontend', async () => {
  const message = await require('../dist/enum-import.js').call()

  expect(message).toMatchInlineSnapshot(`
{
  "Enterprise": "Enterprise",
  "Free": "Free",
  "Paid": "Paid",
}
`)
})

export {}
