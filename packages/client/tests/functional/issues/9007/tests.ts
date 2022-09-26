import testMatrix from './_matrix'
// @ts-ignore
import type { PrismaClient } from './node_modules/@prisma/client'

declare let prisma: PrismaClient

// https://github.com/prisma/prisma/issues/9007
testMatrix.setupTestSuite(
  () => {
    test('should throw an error if using contains filter on uuid type', async () => {
      await prisma.user.create({ data: {} })

      await expect(() =>
        prisma.user.findMany({
          where: {
            // @ts-expect-error
            uuid: { contains: 'foo-bar' },
          },
        }),
      ).rejects.toThrowError()
    })
  },
  {
    optOut: {
      from: ['mongodb', 'sqlserver', 'mysql', 'sqlite'],
      reason: '@db.Uuid not supported here',
    },
  },
)
