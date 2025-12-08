import testMatrix from './_matrix'
// @ts-ignore
import type { PrismaClient } from './generated/prisma/client'

declare let prisma: PrismaClient

testMatrix.setupTestSuite(
  () => {
    test('create with mapped enum', async () => {
      const enrichment = await prisma.suggestionModel.create({
        data: {
          suggestedContent: 'some content',
          status: 'pending',
        },
      })

      expect(enrichment.status).toBe('pending')
    })
  },
  {
    optOut: {
      from: ['sqlite', 'mysql', 'mongodb', 'cockroachdb', 'sqlserver'],
      reason: 'Issue reported for Postgres, keeping it focused.',
    },
  },
)
