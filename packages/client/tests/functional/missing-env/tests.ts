import testMatrix from './_matrix'

// @ts-ignore this is just for type checks
type PrismaClient = import('@prisma/client').PrismaClient
// @ts-ignore this is just for type checks
declare const newPrismaClient: NewPrismaClient<typeof PrismaClient>
// @ts-ignore
declare let Prisma: typeof import('@prisma/client').Prisma

testMatrix.setupTestSuite(
  () => {
    test('PrismaClientInitializationError for missing env', async () => {
      const prisma = newPrismaClient()
      await expect(prisma.$connect()).rejects.toBeInstanceOf(Prisma.PrismaClientInitializationError)
    })
  },
  { skipDb: true, skipDefaultClientInstance: true }, // So we can manually call connect for this test
)
