import { getPlatform } from '@prisma/get-platform'
import { ClientEngineType, getClientEngineType } from '@prisma/internals'
import fs from 'fs'
import path from 'path'

import { generateTestClient } from '../../../../utils/getTestClient'

const testIf = (condition: boolean) => (condition ? test : test.skip)

// Tests that no error is being thrown when the binary is manually set to chmod 644 because Client fixes that itself
testIf(process.platform !== 'win32')('chmod', async () => {
  await generateTestClient()
  const platform = await getPlatform()
  if (getClientEngineType() !== ClientEngineType.Library) {
    const engineBinaryPath = path.join(__dirname, 'node_modules/.prisma/client', `query-engine-${platform}`)
    fs.chmodSync(engineBinaryPath, '644')
  }
  const { PrismaClient } = require('./node_modules/@prisma/client')

  const prisma = new PrismaClient({
    log: [
      {
        emit: 'event',
        level: 'query',
      },
    ],
  })

  await prisma.user.findMany()

  await prisma.$disconnect()

  // TODO expect that chmod is now not 644 any more
})
