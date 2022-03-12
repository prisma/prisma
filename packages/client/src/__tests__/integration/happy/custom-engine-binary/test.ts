import { getNodeAPIName, getPlatform } from '@prisma/get-platform'
import { ClientEngineType, getClientEngineType } from '@prisma/sdk'
import fs from 'fs'
import path from 'path'

import { generateTestClient } from '../../../../utils/getTestClient'

if (getClientEngineType() === ClientEngineType.DataProxy) {
  // eslint-disable-next-line no-global-assign
  test = test.skip
}

test('custom engine path (internal API)', async () => {
  await generateTestClient()

  const platform = await getPlatform()

  let engineFileName =
    getClientEngineType() === ClientEngineType.Library ? getNodeAPIName(platform, 'fs') : `query-engine-${platform}`

  if (process.platform === 'win32' && getClientEngineType() === ClientEngineType.Binary) {
    engineFileName += '.exe'
  }

  const defaultEnginePath = path.join(__dirname, 'node_modules/.prisma/client', engineFileName)
  const customEnginePath = path.join(__dirname, engineFileName)

  fs.copyFileSync(defaultEnginePath, customEnginePath)
  fs.unlinkSync(defaultEnginePath)

  const { PrismaClient } = require('./node_modules/@prisma/client')

  const prisma = new PrismaClient({
    __internal: {
      engine: {
        enginePath: customEnginePath,
      },
    },
  })

  expect(prisma._engineConfig.prismaPath).toBe(customEnginePath)

  if (getClientEngineType() === ClientEngineType.Binary) {
    expect(prisma._engine.prismaPath).toBe(customEnginePath)
    expect(await prisma._engine.getPrismaPath()).toBe(customEnginePath)
  }

  const users = await prisma.user.findMany()
  expect(users).toEqual([])

  prisma.$disconnect()
})
