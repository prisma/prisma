import { getBinaryTargetForCurrentPlatform, getNodeAPIName } from '@prisma/get-platform'
import { ClientEngineType, getClientEngineType } from '@prisma/internals'
import fs from 'node:fs'
import path from 'node:path'

import { generateTestClient } from '../../../../utils/getTestClient'

const testIf = (condition: boolean) => (condition ? test : test.skip)

testIf(!process.env.PRISMA_QUERY_ENGINE_BINARY)('missing-engine: binary', async () => {
  if (getClientEngineType() !== ClientEngineType.Binary) {
    return
  }

  expect.assertions(1)
  await generateTestClient()

  const { PrismaClient } = require('./node_modules/@prisma/client')

  const binaryTarget = await getBinaryTargetForCurrentPlatform()
  let binaryPath =
    getClientEngineType() === ClientEngineType.Library
      ? path.join(__dirname, 'node_modules/.prisma/client', getNodeAPIName(binaryTarget, 'fs'))
      : path.join(__dirname, 'node_modules/.prisma/client', `query-engine-${binaryTarget}`)

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
    "
    Invalid \`prisma.user.findMany()\` invocation in
    /client/src/__tests__/integration/errors/missing-engine/binary.test.ts:0:0

      38 })
      39 
      40 await expect(async () => {
    → 41   await prisma.user.findMany(
    Prisma Client could not locate the Query Engine for runtime "TEST_PLATFORM".

    This is likely caused by tooling that has not copied "query-engine-TEST_PLATFORM" to the deployment folder.
    Ensure that you ran \`prisma generate\` and that "query-engine-TEST_PLATFORM" has been copied to "src/__tests__/integration/errors/missing-engine/node_modules/.prisma/client".

    We would appreciate if you could take the time to share some information with us.
    Please help us by answering a few questions: https://pris.ly/engine-not-found-tooling-investigation

    The following locations have been searched:
      /client/src/__tests__/integration/errors/missing-engine/node_modules/.prisma/client
      /client/src/__tests__/integration/errors/missing-engine/node_modules/@prisma/client
      /client/src/__tests__/integration/errors/missing-engine/node_modules/@prisma/client/runtime
      /tmp/prisma-engines
      /client/src/__tests__/integration/errors/missing-engine"
  `)
})
