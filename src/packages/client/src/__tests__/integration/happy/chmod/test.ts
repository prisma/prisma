import { getPlatform } from '@prisma/get-platform'
import fs from 'fs'
import path from 'path'
import { generateTestClient } from '../../../../utils/getTestClient'

test('chmod', async () => {
  await generateTestClient()
  const platform = await getPlatform()
  const binaryPath = path.join(
    __dirname,
    'node_modules/.prisma/client',
    `query-engine-${platform}`,
  )
  fs.chmodSync(binaryPath, '644')
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

  prisma.$disconnect()
})
