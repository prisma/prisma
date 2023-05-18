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
    Prisma Client could not locate the Query Engine for runtime "TEST_PLATFORM".

    This is likely caused by tooling that has not copied "query-engine-TEST_PLATFORM" to the deployment.
    Please try to make sure that "query-engine-TEST_PLATFORM" is copied to "src/__tests__/integration/errors/missing-engine/node_modules/.prisma/client".

    We would appreciate if you could take the time to share some information with us.
    Please help us by answering a few questions: https://pris.ly/engine-not-found-tooling-investigation

    The following locations have been searched:
      /client/src/__tests__/integration/errors/missing-engine/node_modules/.prisma/client
      /client/src/__tests__/integration/errors/missing-engine/node_modules/@prisma/client
      /client/src/__tests__/integration/errors/missing-engine/node_modules/@prisma/client/runtime
      /tmp/prisma-engines
      /client/src/__tests__/integration/errors/missing-engine
  `)
})
