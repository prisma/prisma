import { getTestClient } from '../../../../utils/getTestClient'

test('error-link', async () => {
  // TODO triggerPanic has not been implemented for N-API
  if (process.env.PRISMA_FORCE_NAPI === 'true') {
    return
  }
  expect.assertions(1)

  const PrismaClient = await getTestClient()
  const db = new PrismaClient({
    __internal: {
      engine: {
        enableEngineDebugMode: true,
      },
    },
    errorFormat: 'minimal',
  })

  await expect(db.__internal_triggerPanic(true)).rejects
    .toThrowErrorMatchingInlineSnapshot(`
          Query engine debug fatal error, shutting down.

          This is a non-recoverable error which probably happens when the Prisma Query Engine has a panic.

          TEST_GITHUB_LINK

          If you want the Prisma team to look into it, please open the link above 🙏
          To increase the chance of success, please post your schema and a snippet of
          how you used Prisma Client in the issue. 

        `)

  db.$disconnect()
})
