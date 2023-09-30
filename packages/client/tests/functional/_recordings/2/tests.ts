// @ts-ignore
import type { PrismaClient } from '@prisma/client'

import testMatrix from './_matrix'

declare let prisma: PrismaClient

testMatrix.setupTestSuite(() => {
  beforeAll(async () => {
    console.log('2 beforeAll')
  })

  test('findFirst', async () => {
    await prisma.user.findFirst()
  })
})
