import testMatrix from './_matrix'
// @ts-ignore
import type { Prisma as PrismaNamespace, PrismaClient } from './node_modules/@prisma/client'

declare let prisma: PrismaClient
declare let Prisma: typeof PrismaNamespace

testMatrix.setupTestSuite(() => {
  test('correctly rejects empty arrays in places where empty objects are allowed', async () => {
    const result = prisma.user.findMany({
      where: {
        // @ts-expect-error
        AND: [[]],
      },
    })

    await expect(result).rejects.toThrow(Prisma.PrismaClientValidationError)
  })
})
