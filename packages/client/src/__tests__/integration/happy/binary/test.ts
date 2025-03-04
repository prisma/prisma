import { getBinaryTargetForCurrentPlatform, getNodeAPIName } from '@prisma/get-platform'
import { ClientEngineType, getClientEngineType } from '@prisma/internals'
import fs from 'node:fs'
import path from 'node:path'

import { generateTestClient } from '../../../../utils/getTestClient'

const testIf = (condition: boolean) => (condition ? test : test.skip)
testIf(!process.env.PRISMA_QUERY_ENGINE_LIBRARY && !process.env.PRISMA_QUERY_ENGINE_BINARY)('binary', async () => {
  expect.assertions(1)
  await generateTestClient()

  const binaryTarget = await getBinaryTargetForCurrentPlatform()
  let binaryPath =
    getClientEngineType() === ClientEngineType.Library
      ? path.join(__dirname, 'node_modules/.prisma/client', getNodeAPIName(binaryTarget, 'fs'))
      : path.join(__dirname, 'node_modules/.prisma/client', `query-engine-${binaryTarget}`)

  if (process.platform === 'win32' && getClientEngineType() === ClientEngineType.Binary) {
    binaryPath += '.exe'
  }

  expect(fs.existsSync(binaryPath)).toBe(true)
})
