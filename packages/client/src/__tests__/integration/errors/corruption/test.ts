import { getBinaryTargetForCurrentPlatform, getNodeAPIName } from '@prisma/get-platform'
import { ClientEngineType, getClientEngineType } from '@prisma/internals'
import fs from 'node:fs'
import path from 'node:path'

import { generateTestClient } from '../../../../utils/getTestClient'

const testIf = (condition: boolean) => (condition ? test : test.skip)
testIf(!(process.env.PRISMA_QUERY_ENGINE_BINARY || process.env.PRISMA_QUERY_ENGINE_LIBRARY))(
  'corruption of query engine binary',
  async () => {
    expect.assertions(1)

    await generateTestClient()
    const { PrismaClient } = require('./node_modules/@prisma/client')
    const binaryTarget = await getBinaryTargetForCurrentPlatform()
    let binaryPath = path.join(
      __dirname,
      'node_modules/.prisma/client',
      getClientEngineType() === ClientEngineType.Library
        ? getNodeAPIName(binaryTarget, 'fs')
        : `query-engine-${binaryTarget}`,
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
  },
)
