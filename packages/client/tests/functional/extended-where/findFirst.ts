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

  test('findFirst with cursor 1 unique (PK)', async () => {
    const data = await prisma.post.findFirst({
      cursor: {
        id: vars.postId2,
      },
    })

    expect(data?.id).toBe(vars.postId2)
  })

  test('findFirst with cursor 2 uniques (PK & non-PK)', async () => {
    const data = await prisma.post.findFirst({
      cursor: {
        id: vars.postId2,
        title: 'Hello World 2',
      },
    })

    expect(data?.id).toBe(vars.postId2)
  })

  test('findFirst with cursor 1 unique (non-PK)', async () => {
    const data = await prisma.post.findFirst({
      cursor: {
        title: 'Hello World 2',
      },
    })

    expect(data?.id).toBe(vars.postId2)
  })
})
