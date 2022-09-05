import crypto from 'crypto'

import { NewPrismaClient } from '../_utils/types'
import testMatrix from './_matrix'
// @ts-ignore
import type { Prisma as PrismaNamespace, PrismaClient } from './node_modules/@prisma/client'

declare let prisma: PrismaClient
declare let Prisma: typeof PrismaNamespace
declare let newPrismaClient: NewPrismaClient<typeof PrismaClient>

testMatrix.setupTestSuite((suiteConfig, suiteMeta) => {
  const userId1 = crypto.randomBytes(12).toString('hex')
  const userId2 = crypto.randomBytes(12).toString('hex')
  const friendId1 = crypto.randomBytes(12).toString('hex')
  const friendId2 = crypto.randomBytes(12).toString('hex')

  beforeAll(async () => {
    const user1 = await prisma.user.create({
      data: {
        id: userId1,
      },
    })

    const user2 = await prisma.user.create({
      data: {
        id: userId2,
      },
    })

    await prisma.friend.create({
      data: {
        id: friendId1,
        friendId: userId1,
        userId: userId2,
      },
    })

    await prisma.friend.create({
      data: {
        id: friendId2,
        friendId: userId2,
        userId: userId1,
      },
    })
  })

  test('count in', async () => {
    const count = await prisma.friend.count({
      where: {
        userId: userId1,
        friendId: {
          in: [userId2, userId2],
        },
      },
    })

    expect(count).toBe(1)
  })

  test('count not in', async () => {
    const count = await prisma.friend.count({
      where: {
        userId: userId1,
        friendId: {
          notIn: [userId2, userId2],
        },
      },
    })

    expect(count).toBe(0)
  })
}, {})
