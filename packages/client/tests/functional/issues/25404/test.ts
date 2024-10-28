// @ts-ignore
import type { PrismaClient } from '@prisma/client'

import testMatrix from './_matrix'

declare let prisma: PrismaClient

testMatrix.setupTestSuite(() => {
  test('should not throw error when using d1 adapter and creating with string field that contains date string', async () => {
    const result = await prisma.user.create({
      data: {
        memo: 'This is user input, 2024-10-09T16:05:08.547Z ',
      },
    })

    expect(result.memo).toEqual('This is user input, 2024-10-09T16:05:08.547Z ')
  })
})
