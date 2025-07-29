import { randomBytes } from 'crypto'

import testMatrix from './_matrix'
// @ts-ignore
import type { PrismaClient } from './generated/prisma/client'

declare let prisma: PrismaClient

const id = randomBytes(12).toString('hex')

testMatrix.setupTestSuite(() => {
  test('transaction', async () => {
    await prisma.$transaction([prisma.user.findUnique({ where: { id } }), prisma.user.findMany()])
  })
})
