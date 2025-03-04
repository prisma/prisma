import { getBinaryTargetForCurrentPlatform, getNodeAPIName } from '@prisma/get-platform'
import { ClientEngineType, getClientEngineType } from '@prisma/internals'
import fs from 'node:fs'
import path from 'node:path'

import { generateTestClient } from '../../../../utils/getTestClient'

const testIf = (condition: boolean) => (condition ? test : test.skip)
testIf(!process.env.PRISMA_QUERY_ENGINE_LIBRARY && !process.env.PRISMA_QUERY_ENGINE_BINARY)(
  'custom engine binary path (internal API)',
  async () => {
    await generateTestClient()

    const binaryTarget = await getBinaryTargetForCurrentPlatform()

    let binaryFileName =
      getClientEngineType() === ClientEngineType.Library
        ? getNodeAPIName(binaryTarget, 'fs')
        : `query-engine-${binaryTarget}`

    if (process.platform === 'win32' && getClientEngineType() === ClientEngineType.Binary) {
      binaryFileName += '.exe'
    }

    const defaultBinaryPath = path.join(__dirname, 'node_modules/.prisma/client', binaryFileName)
    const customBinaryPath = path.join(__dirname, binaryFileName)

    fs.copyFileSync(defaultBinaryPath, customBinaryPath)
    fs.unlinkSync(defaultBinaryPath)

    const { PrismaClient } = require('./node_modules/@prisma/client')

    const prisma = new PrismaClient({
      __internal: {
        engine: {
          binaryPath: customBinaryPath,
        },
      },
    })

    expect(prisma._engineConfig.prismaPath).toBe(customBinaryPath)

    if (getClientEngineType() === ClientEngineType.Binary) {
      expect(prisma._engine.config.prismaPath).toBe(customBinaryPath)
    }

    const users = await prisma.user.findMany()
    expect(users).toEqual([])

    prisma.$disconnect()
  },
)
