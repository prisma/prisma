import testMatrix from './_matrix'
// @ts-ignore
import type { PrismaClient } from './generated/prisma/client'

declare let prisma: PrismaClient

testMatrix.setupTestSuite(
  () => {
    beforeAll(async () => {
      await prisma.$executeRaw`INSERT INTO \`company\` VALUES ('1','neplátce'),('2','plátce');`
    })
    test('correctly returns mapped enums', async () => {
      const result = await prisma.company.findMany({
        select: {
          companyID: true,
          typDPH: true,
        },
      })

      expect(result.length).toBe(2)
    })
  },
  {
    optOut: {
      from: ['postgresql', 'cockroachdb', 'mongodb', 'sqlite', 'sqlserver'],
      reason: 'MySQL',
    },
  },
)
