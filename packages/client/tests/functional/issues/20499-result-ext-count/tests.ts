import testMatrix from './_matrix'
// @ts-ignore
import type { PrismaClient } from './generated/prisma/client'

declare let prisma: PrismaClient

testMatrix.setupTestSuite(() => {
  beforeAll(async () => {
    await prisma.user.create({ data: { password: 'hunter2' } })
  })
  test('result extensions do not break .count', async () => {
    const xprisma = prisma.$extends({
      result: {
        user: {
          password: {
            compute() {
              return undefined
            },
          },
        },
      },
    })

    const count = await xprisma.user.count()
    expect(count).toBe(1)
  })
})
