import { NewPrismaClient } from '../_utils/types'
import testMatrix from './_matrix'
// @ts-ignore
import { PrismaClient } from './generated/prisma/client'

declare let newPrismaClient: NewPrismaClient<typeof PrismaClient>

testMatrix.setupTestSuite(() => {
  test('can disconnect and reconnect', async () => {
    const prisma = newPrismaClient()
    await prisma.user.findMany()
    await prisma.$disconnect()
    await prisma.$connect()
    await prisma.user.findMany()
  })
})
