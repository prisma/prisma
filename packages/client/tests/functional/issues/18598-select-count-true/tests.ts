import testMatrix from './_matrix'
// @ts-ignore
import type { PrismaClient } from './node_modules/@prisma/client'

declare let prisma: PrismaClient

testMatrix.setupTestSuite(() => {
  beforeAll(async () => {
    const { id } = await prisma.user.create({ data: {} })

    await prisma.post.create({ data: { user: { connect: { id } } } })
    await prisma.post.create({ data: { user: { connect: { id } } } })
  })

  test('works with _count shorthand', async () => {
    const user = await prisma.user.findFirst({
      select: {
        _count: true,
      },
    })

    expect(user?._count).toEqual({
      posts: 2,
    })
  })
})
