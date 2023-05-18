import { getNodeAPIName, getPlatform } from '@prisma/get-platform'
import { ClientEngineType, getClientEngineType } from '@prisma/internals'
import fs from 'fs'
import path from 'path'

import { generateTestClient } from '../../../../utils/getTestClient'

test('missing-engine: library', async () => {
  if (getClientEngineType() !== ClientEngineType.Library) {
    return
  }

  expect.assertions(1)
  await generateTestClient()

  const { PrismaClient } = require('./node_modules/@prisma/client')

  const platform = await getPlatform()
  const binaryPath =
    getClientEngineType() === ClientEngineType.Library
      ? path.join(__dirname, 'node_modules/.prisma/client', getNodeAPIName(platform, 'fs'))
      : path.join(__dirname, 'node_modules/.prisma/client', `query-engine-${platform}`)
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
    /client/src/__tests__/integration/errors/missing-engine/library.test.ts:0:0

      31 })
      32 
      33 await expect(async () => {
    → 34   await prisma.user.findMany(
    Prisma Client could not locate the Query Engine for runtime "TEST_PLATFORM".

    This is likely caused by tooling that has not copied "libquery_engine-TEST_PLATFORM.LIBRARY_TYPE.node" to the deployment.
    Please try to make sure that "libquery_engine-TEST_PLATFORM.so.node" is copied to "src/__tests__/integration/errors/missing-engine/node_modules/.prisma/client".

    We would appreciate if you could take the time to share some information with us.
    Please help us by answering a few questions: https://pris.ly/engine-not-found-tooling-investigation

    The following locations have been searched:
      /client/src/__tests__/integration/errors/missing-engine/node_modules/.prisma/client
      /client/src/__tests__/integration/errors/missing-engine/node_modules/@prisma/client
      /client/src/__tests__/integration/errors/missing-engine/node_modules/@prisma/client/runtime
      /client/src/__tests__/integration/errors/missing-engine
      /tmp/prisma-engines
  `)
})
