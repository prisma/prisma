import testMatrix from './_matrix'

// @ts-ignore this is just for type checks
declare let prisma: import('@prisma/client').PrismaClient
// @ts-ignore this is just for type checks
declare let Prisma: import('@prisma/client').Prisma

testMatrix.setupTestSuite(
  () => {
    test('should not throw when using Prisma.empty inside $executeRaw', async () => {
      const result = await prisma.$executeRaw(Prisma.empty)

      expect(result).toEqual(null)
    })

    test('should not throw when using Prisma.empty inside $queryRaw', async () => {
      const result = await prisma.$queryRaw(Prisma.empty)

      expect(result).toEqual(null)
    })
  },
  {
    optOut: {
      from: ['mongodb'],
      reason: '$raw methods not allowed when using mongondb',
    },
  },
)
