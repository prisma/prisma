import { getNodeAPIName, getPlatform } from '@prisma/get-platform'
import { ClientEngineType, getClientEngineType } from '@prisma/internals'
import fs from 'fs'
import path from 'path'

import { generateTestClient } from '../../../../utils/getTestClient'

test('missing-engine: binary', async () => {
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
    /client/src/__tests__/integration/errors/missing-engine/binary.test.ts:0:0

      36 })
      37 
      38 await expect(async () => {
    → 39   await prisma.user.findMany(
    Query engine binary for current platform "TEST_PLATFORM" could not be found.
    This probably happens, because you built Prisma Client on a different platform.
    (Prisma Client looked in "/client/src/__tests__/integration/errors/missing-engine/node_modules/@prisma/client/runtime/query-engine-TEST_PLATFORM")

    Searched Locations:

      /client/src/__tests__/integration/errors/missing-engine/node_modules/.prisma/client
      /client/src/__tests__/integration/errors/missing-engine/node_modules/@prisma/client


    To solve this problem, add the platform "TEST_PLATFORM" to the "binaryTargets" attribute in the "generator" block in the "schema.prisma" file:
    generator client {
      provider      = "prisma-client-js"
      binaryTargets = ["native"]
    }

    Then run "prisma generate" for your changes to take effect.
    Read more about deploying Prisma Client: https://pris.ly/d/client-generator
  `)
})
