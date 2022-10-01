import testMatrix from './_matrix'
// @ts-ignore
import type { PrismaClient } from './node_modules/@prisma/client'

declare let prisma: PrismaClient

testMatrix.setupTestSuite(
  () => {
    test('upsert should not fail', async () => {
      await prisma.resource.upsert({
        where: {
          id: 2147483647 + 1,
        },
        update: {},
        create: {
          id: 2147483647 + 1,
        },
      })

      await prisma.resource.upsert({
        where: {
          id: 2147483647 + 1,
        },
        update: {},
        create: {
          id: 2147483647 + 1,
        },
      })
    })
  },
  {
    optOut: {
      from: ['sqlite', 'postgresql', 'mongodb', 'cockroachdb', 'sqlserver'],
      reason: 'This issue only happens on MySQL',
    },
  },
)
