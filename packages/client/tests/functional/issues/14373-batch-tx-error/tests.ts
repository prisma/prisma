// @ts-ignore
import type { PrismaClient } from '@prisma/client'

import testMatrix from './_matrix'

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

    await expect(result).rejects.toThrowError('Invalid `prisma.user.update()` invocation')
  })
})
