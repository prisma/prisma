import testMatrix from './_matrix'
// @ts-ignore
import type { PrismaClient } from './generated/prisma/client'

declare let prisma: PrismaClient

testMatrix.setupTestSuite(() => {
  test('correctly reports location of a batch error', async () => {
    const result = prisma.$transaction([
      prisma.user.findMany({}),
      prisma.user.update({
        where: {
          email: 'notthere@example.com',
        },
        data: {
          memo: 'id is 1',
        },
      }),
    ])

    await expect(result).rejects.toThrow('Invalid `prisma.user.update()` invocation')
  })
})
