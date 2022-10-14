// @ts-ignore
import type { PrismaClient } from '@prisma/client'

import testMatrix from './_matrix'

declare let prisma: PrismaClient

// https://github.com/prisma/prisma/issues/12572
testMatrix.setupTestSuite(() => {
  test('should have equal dates on record creation for @default(now) and @updatedAt', async () => {
    const created = await prisma.user.create({ data: {} })

    const createdAt = new Date(created.createdAt)
    const updatedAt = new Date(created.updatedAt)

    expect(createdAt.getDate()).toEqual(updatedAt.getDate())
  })
})
