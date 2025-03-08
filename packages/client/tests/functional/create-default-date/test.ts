import { Providers } from '../_utils/providers'
import testMatrix from './_matrix'
// @ts-ignore
import type { PrismaClient } from './node_modules/@prisma/client'

declare let prisma: PrismaClient

testMatrix.setupTestSuite(
  () => {
    test('correctly creates a field with default date', async () => {
      const visit = await prisma.visit.create({})
      expect(visit.visitTime).toBeInstanceOf(Date)
    })
  },
  {
    optOut: {
      from: [Providers.MONGODB, Providers.COCKROACHDB],
      reason: 'create with no arguments is possible only with autoincrement/dbgenerated primary key',
    },
  },
)
