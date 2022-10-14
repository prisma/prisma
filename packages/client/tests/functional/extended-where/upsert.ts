import { randomBytes } from 'crypto'

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

  test('upsert with where 1 unique (PK)', async () => {
    const referralId = randomBytes(12).toString('hex')
    await prisma.user.upsert({
      where: {
        id: vars.userId,
      },
      create: {
        referralId,
      },
      update: {},
    })
  })

  test('upsert with where 2 uniques (PK & non-PK)', async () => {
    await prisma.post.upsert({
      where: {
        id: vars.postId1,
        title: 'Hello World 1',
      },
      create: {
        title: 'Hello World 1',
        authorId: vars.userId,
      },
      update: {
        title: 'Hello World 4',
      },
    })
  })

  test('upsert with where 1 unique (non-PK)', async () => {
    await prisma.post.upsert({
      where: {
        title: 'Hello World 2',
      },
      create: {
        title: 'Hello World 2',
        authorId: vars.userId,
      },
      update: {
        title: 'Hello World 5',
      },
    })
  })
})
