import testMatrix from './_matrix'
// @ts-ignore
import type { PrismaClient } from './node_modules/@prisma/client'

declare let prisma: PrismaClient

testMatrix.setupTestSuite(
  () => {
    test('SELECT NULL works', async () => {
      const result = await prisma.$queryRaw`SELECT NULL AS result`
      expect(result).toEqual([{ result: null }])
    })
  },
  {
    optOut: {
      from: ['mongodb'],
      reason: 'Raw SQL query requires an SQL database',
    },
  },
)
