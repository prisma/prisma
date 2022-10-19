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

  test('aggregate with cursor 1 unique (PK)', async () => {
    const data = await prisma.post.aggregate({
      cursor: {
        id: vars.postId2,
      },
      _count: true,
    })

    expect(data._count).toBe(2)
  })

  test('aggregate with cursor 2 uniques (PK & non-PK)', async () => {
    const data = await prisma.post.aggregate({
      cursor: {
        id: vars.postId2,
        title: 'Hello World 2',
      },
      _count: true,
    })

    expect(data._count).toBe(2)
  })

  test('update with where 1 unique (non-PK)', async () => {
    const data = await prisma.post.aggregate({
      cursor: {
        title: 'Hello World 2',
      },
      _count: true,
    })

    expect(data._count).toBe(2)
  })
})
