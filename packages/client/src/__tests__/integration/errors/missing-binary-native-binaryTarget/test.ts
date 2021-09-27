import { getNodeAPIName, getPlatform } from '@prisma/get-platform'
import fs from 'fs'
import path from 'path'
import {
  ClientEngineType,
  getClientEngineType,
} from '../../../../runtime/utils/getClientEngineType'
import { generateTestClient } from '../../../../utils/getTestClient'

test('missing binary, native binaryTarget', async () => {
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

  if (getClientEngineType() === ClientEngineType.Library) {
    // When updating snapshots this is sensitive to OS, here Linux
    // macOS will update extension to .dylib.node, but we need to kepp .so.node for CI
    await expect(async () => {
      await prisma.user.findMany()
    }).rejects.toThrowErrorMatchingInlineSnapshot(`

                        Invalid \`prisma.user.findMany()\` invocation in
                        /client/src/__tests__/integration/errors/missing-binary-native-binaryTarget/test.ts:0:0

                          40 // When updating snapshots this is sensitive to OS, here Linux
                          41 // macOS will update extension to .dylib.node, but we need to kepp .so.node for CI
                          42 await expect(async () => {
                        → 43   await prisma.user.findMany(
                          Query engine library for current platform "TEST_PLATFORM" could not be found.
                        You incorrectly pinned it to TEST_PLATFORM

                        This probably happens, because you built Prisma Client on a different platform.
                        (Prisma Client looked in "/client/src/__tests__/integration/errors/missing-binary-native-binaryTarget/node_modules/@prisma/client/runtime/libquery_engine-TEST_PLATFORM.so.node")

                        Searched Locations:

                          /client/src/__tests__/integration/errors/missing-binary-native-binaryTarget/node_modules/.prisma/client
                          /client/src/__tests__/integration/errors/missing-binary-native-binaryTarget/node_modules/@prisma/client/runtime
                          /client/src/__tests__/integration/errors/missing-binary-native-binaryTarget/node_modules/@prisma/client
                          /client/src/__tests__/integration/errors/missing-binary-native-binaryTarget/node_modules/.prisma/client
                          /client/src/__tests__/integration/errors/missing-binary-native-binaryTarget
                          /tmp/prisma-engines
                          /client/src/__tests__/integration/errors/missing-binary-native-binaryTarget/node_modules/.prisma/client

                        You already added the platform "native" to the "generator" block
                        in the "schema.prisma" file as described in https://pris.ly/d/client-generator,
                        but something went wrong. That's suboptimal.

                        Please create an issue at TEST_GITHUB_LINK
                    `)
  } else {
    await expect(async () => {
      await prisma.user.findMany()
    }).rejects.toThrowErrorMatchingInlineSnapshot(`

            Invalid \`prisma.user.findMany()\` invocation in
            /client/src/__tests__/integration/errors/missing-binary-native-binaryTarget/test.ts:0:0

               74         \`)
               75 } else {
               76   await expect(async () => {
            →  77     await prisma.user.findMany(
              Query engine binary for current platform "TEST_PLATFORM" could not be found.
            This probably happens, because you built Prisma Client on a different platform.
            (Prisma Client looked in "/client/src/__tests__/integration/errors/missing-binary-native-binaryTarget/node_modules/@prisma/client/runtime/query-engine-TEST_PLATFORM")

            Searched Locations:

              /client/src/__tests__/integration/errors/missing-binary-native-binaryTarget/node_modules/.prisma/client
              /client/src/__tests__/integration/errors/missing-binary-native-binaryTarget/node_modules/@prisma/client/runtime
              /client/src/__tests__/integration/errors/missing-binary-native-binaryTarget/node_modules/@prisma/client
              /client/src/__tests__/integration/errors/missing-binary-native-binaryTarget/node_modules/.prisma/client
              /client/src/__tests__/integration/errors/missing-binary-native-binaryTarget
              /tmp/prisma-engines
              /client/src/__tests__/integration/errors/missing-binary-native-binaryTarget/node_modules/.prisma/client

            You already added the platform "native" to the "generator" block
            in the "schema.prisma" file as described in https://pris.ly/d/client-generator,
            but something went wrong. That's suboptimal.

            Please create an issue at TEST_GITHUB_LINK
          `)
  }
})
