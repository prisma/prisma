import { getPlatform } from '@prisma/get-platform'
import fs from 'fs'
import path from 'path'
import { generateTestClient } from '../../../../utils/getTestClient'

test('custom engine binary path (internal API)', async () => {
  await generateTestClient()

  const platform = await getPlatform()
  const defaultBinaryPath = path.join(__dirname, 'node_modules/.prisma/client', `query-engine-${platform}`)
  const customBinaryPath = path.join(__dirname, `query-engine-${platform}`)

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

  expect(prisma._engine.prismaPath).toBe(customBinaryPath)
  expect(await prisma._engine.getPrismaPath()).toBe(customBinaryPath)

  const users = await prisma.user.findMany()
  expect(users).toEqual([])

  prisma.$disconnect()
})
