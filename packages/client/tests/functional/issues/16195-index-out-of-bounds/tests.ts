import { randomBytes } from 'crypto'

import testMatrix from './_matrix'
// @ts-ignore
import type { PrismaClient } from './node_modules/@prisma/client'

declare let prisma: PrismaClient

const id = randomBytes(12).toString('hex')

testMatrix.setupTestSuite((suiteConfig, suiteMeta) => {
  test('transaction', async () => {
    await prisma.$transaction([prisma.user.findUnique({ where: { id } }), prisma.user.findMany()])
  })
})
