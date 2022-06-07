import { getNodeAPIName, getPlatform } from '@prisma/get-platform'
import { ClientEngineType, getClientEngineType } from '@prisma/sdk'
import fs from 'fs'
import path from 'path'

import { generateTestClient } from '../../../../utils/getTestClient'

test('custom engine binary path (internal API)', async () => {
  await generateTestClient()

  const platform = await getPlatform()

  let binaryFileName =
    getClientEngineType() === ClientEngineType.Library ? getNodeAPIName(platform, 'fs') : `query-engine-${platform}`

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
    expect(prisma._engine.prismaPath).toBe(customBinaryPath)
    expect(await prisma._engine.getPrismaPath()).toBe(customBinaryPath)
  }

  const users = await prisma.user.findMany()
  expect(users).toEqual([])

  prisma.$disconnect()
})
