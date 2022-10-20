import testMatrix from './_matrix'
// @ts-ignore
import type { PrismaClient } from './node_modules/@prisma/client'

declare let prisma: PrismaClient

testMatrix.setupTestSuite(
  (suiteConfig, suiteMeta) => {
    test('example', async () => {
      await prisma.$transaction([
        prisma.user.create({ data: { email: 'john1@doe.io' } }),
        prisma.user.create({ data: { email: 'john2@doe.io' } }),
        prisma.user.create({ data: { email: 'john3@doe.io' } }),
        prisma.user.create({ data: { email: 'john1@doe.io' } }),
      ])
    })
  },
  {
    optOut: {
      from: ['postgresql', 'mysql', 'mongodb', 'cockroachdb', 'sqlserver'],
      reason: 'this is something that is handled by the client',
    },
  },
)
