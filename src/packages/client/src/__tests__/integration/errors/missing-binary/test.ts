import { generateTestClient } from '../../../../utils/getTestClient'
import fs from 'fs'
import path from 'path'
import { getPlatform } from '@prisma/get-platform'

test('missing-binary', async () => {
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
          (Prisma Client looked in "/client/src/__tests__/integration/errors/missing-binary/node_modules/@prisma/client/runtime/commonjs/query-engine-TEST_PLATFORM")

          Searched Locations:

            /client/src/__tests__/integration/errors/missing-binary/node_modules/@prisma/.prisma/client
            /client/src/__tests__/integration/errors/missing-binary/node_modules/@prisma/client/runtime/commonjs
            /client/src/__tests__/integration/errors/missing-binary/node_modules/@prisma/client/runtime
            /client/src/__tests__/integration/errors/missing-binary/node_modules/.prisma/client
            /client/src/__tests__/integration/errors/missing-binary
            /client/src/__tests__/integration/errors/missing-binary/node_modules/.prisma/client


          To solve this problem, add the platform "TEST_PLATFORM" to the "generator" block in the "schema.prisma" file:
          generator client {
            provider      = "prisma-client-js"
            binaryTargets = ["native"]
          }

          Then run "prisma generate" for your changes to take effect.
          Read more about deploying Prisma Client: https://pris.ly/d/client-generator
        `)
})
