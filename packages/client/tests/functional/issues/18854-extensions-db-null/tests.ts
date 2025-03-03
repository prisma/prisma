import testMatrix from './_matrix'
// @ts-ignore
import type { Prisma as PrismaNamespace, PrismaClient } from './node_modules/@prisma/client'

declare let prisma: PrismaClient
declare let Prisma: typeof PrismaNamespace

testMatrix.setupTestSuite(
  () => {
    test('allows to use DbNull together with query extensions', async () => {
      const xprisma = prisma.$extends({
        query: {
          $allModels: {
            $allOperations({ args, query }) {
              return query(args)
            },
          },
        },
      })

      await expect(xprisma.user.create({ data: { json: Prisma.DbNull } })).resolves.not.toThrow()
    })
  },
  {
    optOut: {
      from: ['sqlserver', 'mongodb'],
      reason: `
        sqlserver JSON column is not supported
        mongodb - DbNull is not supported
      `,
    },
  },
)
