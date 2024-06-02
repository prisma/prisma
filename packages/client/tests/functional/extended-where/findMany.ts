import { NewPrismaClient } from '../_utils/types'
import testMatrix from './_matrix'
import { setup } from './_setup'
/* eslint-disable @typescript-eslint/no-unused-vars */
// @ts-ignore this is just for type checks
import type { PrismaClient } from './node_modules/@prisma/client'

declare let prisma: PrismaClient<{ log: [{ emit: 'event'; level: 'query' }] }>
declare let newPrismaClient: NewPrismaClient<typeof PrismaClient>

let vars: Awaited<ReturnType<typeof setup>>
testMatrix.setupTestSuite(() => {
  beforeAll(async () => {
    prisma = newPrismaClient({
      log: ['query'],
    })

    vars = await setup(prisma)
  })

  test('findMany with cursor 1 unique (PK)', async () => {
    const data = await prisma.post.findMany({
      cursor: {
        id: vars.postId2,
      },
    })

    expect(data.length).toBe(2)
  })

  test('findMany with cursor 2 uniques (PK & non-PK)', async () => {
    const data = await prisma.post.findMany({
      cursor: {
        id: vars.postId2,
        title: 'Hello World 2',
      },
    })

    expect(data.length).toBe(2)
  })

  test('findMany with cursor 1 unique (non-PK)', async () => {
    const data = await prisma.post.findMany({
      cursor: {
        title: 'Hello World 2',
      },
    })

    expect(data.length).toBe(2)
  })
})
