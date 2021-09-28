import { getNodeAPIName, getPlatform } from '@prisma/get-platform'
import fs from 'fs'
import path from 'path'
import {
  ClientEngineType,
  getClientEngineType,
} from '../../../../runtime/utils/getClientEngineType'
import { generateTestClient } from '../../../../utils/getTestClient'

test('missing-binary', async () => {
  expect.assertions(1)
  await generateTestClient()

  const { PrismaClient } = require('./node_modules/@prisma/client')

  const platform = await getPlatform()
  const binaryPath =
    getClientEngineType() === ClientEngineType.Library
      ? path.join(
          __dirname,
          'node_modules/.prisma/client',
          getNodeAPIName(platform, 'fs'),
        )
      : path.join(
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
  // TODO Error should not be as fundamentally different here as the test snapshots indicate
  // TODO The error messages here are also not good (correct) and should be fixed
  if (getClientEngineType() === ClientEngineType.Library) {
    // When updating snapshots this is sensitive to OS, here Linux
    // macOS will update extension to .dylib.node, but we need to kepp .so.node for CI
    await expect(async () => {
      await prisma.user.findMany()
    }).rejects.toThrowErrorMatchingInlineSnapshot(`

                                                                        Invalid \`prisma.user.findMany()\` invocation in
                                                                        /client/src/__tests__/integration/errors/missing-binary/test.ts:0:0

                                                                          41 // When updating snapshots this is sensitive to OS, here Linux
                                                                          42 // macOS will update extension to .dylib.node, but we need to kepp .so.node for CI
                                                                          43 await expect(async () => {
                                                                        → 44   await prisma.user.findMany(
                                                                          Query engine library for current platform "TEST_PLATFORM" could not be found.
                                                                        You incorrectly pinned it to TEST_PLATFORM

                                                                        This probably happens, because you built Prisma Client on a different platform.
                                                                        (Prisma Client looked in "/client/src/__tests__/integration/errors/missing-binary/node_modules/@prisma/client/runtime/libquery_engine-TEST_PLATFORM.so.node")

                                                                        Searched Locations:

                                                                          /client/src/__tests__/integration/errors/missing-binary/node_modules/.prisma/client
                                                                          /client/src/__tests__/integration/errors/missing-binary/node_modules/@prisma/client/runtime
                                                                          /client/src/__tests__/integration/errors/missing-binary/node_modules/@prisma/client
                                                                          /client/src/__tests__/integration/errors/missing-binary/node_modules/.prisma/client
                                                                          /client/src/__tests__/integration/errors/missing-binary
                                                                          /tmp/prisma-engines
                                                                          /client/src/__tests__/integration/errors/missing-binary/node_modules/.prisma/client


                                                                        To solve this problem, add the platform "TEST_PLATFORM" to the "binaryTargets" attribute in the "generator" block in the "schema.prisma" file:
                                                                        generator client {
                                                                          provider      = "prisma-client-js"
                                                                          binaryTargets = ["native"]
                                                                        }

                                                                        Then run "prisma generate" for your changes to take effect.
                                                                        Read more about deploying Prisma Client: https://pris.ly/d/client-generator
                                                            `)
  } else {
    await expect(async () => {
      await prisma.user.findMany()
    }).rejects.toThrowErrorMatchingInlineSnapshot(`

            Invalid \`prisma.user.findMany()\` invocation in
            /client/src/__tests__/integration/errors/missing-binary/test.ts:0:0

               79                                                 \`)
               80 } else {
               81   await expect(async () => {
            →  82     await prisma.user.findMany(
              Query engine binary for current platform "TEST_PLATFORM" could not be found.
            This probably happens, because you built Prisma Client on a different platform.
            (Prisma Client looked in "/client/src/__tests__/integration/errors/missing-binary/node_modules/@prisma/client/runtime/query-engine-TEST_PLATFORM")

            Searched Locations:

              /client/src/__tests__/integration/errors/missing-binary/node_modules/.prisma/client
              /client/src/__tests__/integration/errors/missing-binary/node_modules/@prisma/client/runtime
              /client/src/__tests__/integration/errors/missing-binary/node_modules/@prisma/client
              /client/src/__tests__/integration/errors/missing-binary/node_modules/.prisma/client
              /client/src/__tests__/integration/errors/missing-binary
              /tmp/prisma-engines
              /client/src/__tests__/integration/errors/missing-binary/node_modules/.prisma/client


            To solve this problem, add the platform "TEST_PLATFORM" to the "binaryTargets" attribute in the "generator" block in the "schema.prisma" file:
            generator client {
              provider      = "prisma-client-js"
              binaryTargets = ["native"]
            }

            Then run "prisma generate" for your changes to take effect.
            Read more about deploying Prisma Client: https://pris.ly/d/client-generator
          `)
  }
})
