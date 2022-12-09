import testMatrix from './_matrix'
import { setup } from './_setup'
// @ts-ignore
import type { PrismaClient } from './node_modules/@prisma/client'

declare let prisma: PrismaClient

let vars: Awaited<ReturnType<typeof setup>>
testMatrix.setupTestSuite(() => {
  beforeAll(async () => {
    vars = await setup(prisma)
  })

  test('findUnique with where 1 unique (PK)', async () => {
    const data = await prisma.user.findUnique({
      where: {
        id: vars.userId,
      },
    })

    expect(data?.id).toBe(vars.userId)
  })

  test('findUnique with where 2 uniques (PK & non-PK)', async () => {
    const data = await prisma.post.findUnique({
      where: {
        id: vars.postId1,
        title: 'Hello World 1',
      },
    })

    expect(data?.id).toBe(vars.postId1)
  })

  test('findUnique with where 1 unique (non-PK)', async () => {
    const data = await prisma.post.findUnique({
      where: {
        title: 'Hello World 2',
      },
    })

    expect(data?.id).toBe(vars.postId2)
  })
})
