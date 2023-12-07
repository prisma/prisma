import { getNodeAPIName, getPlatform } from '@prisma/get-platform'
import { ClientEngineType, getClientEngineType } from '@prisma/internals'
import fs from 'fs'
import path from 'path'

import { generateTestClient } from '../../../../utils/getTestClient'

const testIf = (condition: boolean) => (condition ? test : test.skip)
testIf(!process.env.PRISMA_QUERY_ENGINE_LIBRARY && !process.env.PRISMA_QUERY_ENGINE_BINARY)('binary', async () => {
  expect.assertions(1)
  await generateTestClient()

  const platform = await getPlatform()
  let binaryPath =
    getClientEngineType() === ClientEngineType.Library
      ? path.join(__dirname, 'node_modules/.prisma/client', getNodeAPIName(platform, 'fs'))
      : path.join(__dirname, 'node_modules/.prisma/client', `query-engine-${platform}`)

  if (process.platform === 'win32' && getClientEngineType() === ClientEngineType.Binary) {
    binaryPath += '.exe'
  }

  expect(fs.existsSync(binaryPath)).toBe(true)
})
