import { generateTestClient } from '../../../../utils/getTestClient'
import fs from 'fs'
import path from 'path'
import { getPlatform } from '@prisma/get-platform'

test('missing-binary-native', async () => {
  expect.assertions(1)
  await generateTestClient()

  const { PrismaClient } = require('./node_modules/@prisma/client')

  const platform = await getPlatform()
  const binaryPath = path.join(
    __dirname,
    'node_modules/.prisma/client',
    `query-engine-${platform}`,
  )
  fs.unlinkSync(binaryPath)
  const prisma = new PrismaClient({
    log: [
      {
        emit: 'event',
        level: 'query',
      },
    ],
  })

  await expect(async () => {
    await prisma.user.findMany()
  }).rejects.toThrowErrorMatchingInlineSnapshot(`

          Invalid \`prisma.user.findMany()\` invocation:


            Query engine binary for current platform "TEST_PLATFORM" could not be found.
          This probably happens, because you built Prisma Client on a different platform.
          (Prisma Client looked in "/client/src/__tests__/integration/errors/missing-binary-native/node_modules/@prisma/client/runtime/query-engine-TEST_PLATFORM")

          Searched Locations:

            /client/src/__tests__/integration/errors/missing-binary-native/node_modules/.prisma/client
            /client/src/__tests__/integration/errors/missing-binary-native/node_modules/@prisma/client/runtime
            /client/src/__tests__/integration/errors/missing-binary-native/node_modules/@prisma/client
            /client/src/__tests__/integration/errors/missing-binary-native/node_modules/.prisma/client
            /client/src/__tests__/integration/errors/missing-binary-native

          You already added the platform "native" to the "generator" block
          in the "schema.prisma" file as described in https://pris.ly/d/client-generator,
          but something went wrong. That's suboptimal.

          Please create an issue at TEST_GITHUB_LINK
        `)
})
