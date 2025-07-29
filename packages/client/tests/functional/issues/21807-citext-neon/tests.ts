import testMatrix from './_matrix'
// @ts-ignore
import type { PrismaClient } from './generated/prisma/client'

declare let prisma: PrismaClient

// Regression test for https://github.com/prisma/prisma/issues/21807
testMatrix.setupTestSuite(
  () => {
    test('writing and reading a citext field works', async () => {
      const writtenRecord = await prisma.model.create({
        data: {
          slug: 'someslug',
        },
      })

      const readRecords = await prisma.model.findMany({
        where: {
          slug: {
            equals: 'sOMeSluG',
          },
        },
      })

      const readRecordsRaw = await prisma.$queryRaw`SELECT * FROM "Model" WHERE "slug" = 'SomesluG'`

      expect(readRecords).toEqual([writtenRecord])
      expect(readRecordsRaw).toEqual([writtenRecord])
      expect(writtenRecord.slug).toBe('someslug')
    })
  },
  {
    optOut: {
      from: ['cockroachdb', 'mysql', 'mongodb', 'sqlite', 'sqlserver'],
      reason: 'Uses PostgreSQL extensions',
    },
  },
)
