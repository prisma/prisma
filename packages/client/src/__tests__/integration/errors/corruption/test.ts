import { getNodeAPIName, getPlatform } from '@prisma/get-platform'
import { ClientEngineType, getClientEngineType } from '@prisma/internals'
import fs from 'fs'
import path from 'path'

import { generateTestClient } from '../../../../utils/getTestClient'

test('corruption of query engine binary', async () => {
  expect.assertions(1)

  await generateTestClient()
  const { PrismaClient } = require('./node_modules/@prisma/client')
  const platform = await getPlatform()
  let binaryPath = path.join(
    __dirname,
    'node_modules/.prisma/client',
    getClientEngineType() === ClientEngineType.Library ? getNodeAPIName(platform, 'fs') : `query-engine-${platform}`,
  )

  if (process.platform === 'win32' && getClientEngineType() === ClientEngineType.Binary) {
    binaryPath += '.exe'
  }

  fs.writeFileSync(binaryPath, 'hello world')

  const prisma = new PrismaClient({
    log: [
      {
        emit: 'event',
        level: 'query',
      },
    ],
    errorFormat: 'minimal',
  })

  await expect(prisma.user.findMany()).rejects.toThrow()
})
