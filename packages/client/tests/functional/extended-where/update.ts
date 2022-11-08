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

  test('update with where 1 unique (PK)', async () => {
    const data = await prisma.user.update({
      where: {
        id: vars.userId,
      },
      data: {},
    })

    expect(data.id).toBe(vars.userId)
  })

  test('update with where 2 uniques (PK & non-PK)', async () => {
    const data = await prisma.post.update({
      where: {
        id: vars.postId1,
        title: 'Hello World 1',
      },
      data: {
        title: 'Hello World 4',
      },
    })

    expect(data.title).toBe('Hello World 4')
  })

  test('update with where 1 unique (non-PK)', async () => {
    const data = await prisma.post.update({
      where: {
        title: 'Hello World 2',
      },
      data: {
        title: 'Hello World 5',
      },
    })

    expect(data.title).toBe('Hello World 5')
  })
})
