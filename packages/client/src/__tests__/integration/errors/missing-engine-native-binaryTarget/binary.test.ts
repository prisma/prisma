import { getNodeAPIName, getPlatform } from '@prisma/get-platform'
import { ClientEngineType, getClientEngineType } from '@prisma/internals'
import fs from 'fs'
import path from 'path'

import { generateTestClient } from '../../../../utils/getTestClient'

test('missing-engine-native-binaryTarget: binary', async () => {
  if (getClientEngineType() !== ClientEngineType.Binary) {
    return
  }

  expect.assertions(1)
  await generateTestClient()

  const { PrismaClient } = require('./node_modules/@prisma/client')

  const platform = await getPlatform()
  let binaryPath =
    getClientEngineType() === ClientEngineType.Library
      ? path.join(__dirname, 'node_modules/.prisma/client', getNodeAPIName(platform, 'fs'))
      : path.join(__dirname, 'node_modules/.prisma/client', `query-engine-${platform}`)

  if (process.platform === 'win32') {
    binaryPath += '.exe'
  }

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

          Invalid \`prisma.user.findMany()\` invocation in
          /client/src/__tests__/integration/errors/missing-engine-native-binaryTarget/binary.test.ts:0:0

            36 })
            37 
            38 await expect(async () => {
          → 39   await prisma.user.findMany(
            Query engine binary for current platform "TEST_PLATFORM" could not be found.
          This probably happens, because you built Prisma Client on a different platform.
          (Prisma Client looked in "/client/src/__tests__/integration/errors/missing-engine-native-binaryTarget/node_modules/@prisma/client/runtime/query-engine-TEST_PLATFORM")

          Searched Locations:

            /client/src/__tests__/integration/errors/missing-engine-native-binaryTarget/node_modules/.prisma/client
            /client/src/__tests__/integration/errors/missing-engine-native-binaryTarget/node_modules/@prisma/client/runtime
            /client/src/__tests__/integration/errors/missing-engine-native-binaryTarget/node_modules/@prisma/client
            /client/src/__tests__/integration/errors/missing-engine-native-binaryTarget/node_modules/.prisma/client
            /client/src/__tests__/integration/errors/missing-engine-native-binaryTarget
            /tmp/prisma-engines
            /client/src/__tests__/integration/errors/missing-engine-native-binaryTarget/node_modules/.prisma/client

          You already added the platform "native" to the "generator" block
          in the "schema.prisma" file as described in https://pris.ly/d/client-generator,
          but something went wrong. That's suboptimal.

          Please create an issue at https://github.com/prisma/prisma/issues/new
        `)
})
