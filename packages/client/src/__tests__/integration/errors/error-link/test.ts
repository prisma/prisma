import { ClientEngineType, getClientEngineType } from '@prisma/internals'

import { generateTestClient } from '../../../../utils/getTestClient'

test('error-link', async () => {
  // TODO triggerPanic has not been implemented for Node-API: https://github.com/prisma/prisma/issues/7810
  if (getClientEngineType() === ClientEngineType.Library) {
    return
  }

  expect.assertions(1)

  await generateTestClient()
  const { PrismaClient } = require('./node_modules/@prisma/client')
  const db = new PrismaClient({
    __internal: {
      engine: {
        allowTriggerPanic: true,
      },
    },
    errorFormat: 'minimal',
  })

  await expect(db.__internal_triggerPanic(true)).rejects.toThrowErrorMatchingInlineSnapshot(`
          Query engine debug fatal error, shutting down.

          This is a non-recoverable error which probably happens when the Prisma Query Engine has a panic.

          TEST_GITHUB_LINK

          If you want the Prisma team to look into it, please open the link above 🙏
          To increase the chance of success, please post your schema and a snippet of
          how you used Prisma Client in the issue. 

        `)

  db.$disconnect()
})
