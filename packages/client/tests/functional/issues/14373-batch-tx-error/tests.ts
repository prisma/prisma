// @ts-ignore
import type { PrismaClient } from '@prisma/client'

import testMatrix from './_matrix'

declare let prisma: PrismaClient

testMatrix.setupTestSuite((suiteConfig, suiteMeta) => {
  test('correctly reports error location for batch tx', async () => {
    const result = prisma.$transaction([
      prisma.user.findMany({}),
      prisma.user.update({
        where: {
          id: 'not here',
        },
        data: {
          memo: 'id is 1',
        },
      }),
    ])

    await expect(result).rejects.toThrowError('Invalid `prisma.user.update()` invocation')
  })
})
