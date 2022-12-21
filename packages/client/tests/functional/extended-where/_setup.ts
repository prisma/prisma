import { randomBytes } from 'crypto'

// @ts-ignore
import type { PrismaClient } from './node_modules/@prisma/client'

export async function setup(_prisma: unknown) {
  const userId1 = randomBytes(12).toString('hex')
  const referralId = randomBytes(12).toString('hex')
  const postId1 = `01${randomBytes(11).toString('hex')}`
  const postId2 = `02${randomBytes(11).toString('hex')}`
  const postId3 = `03${randomBytes(11).toString('hex')}`
  const profileId = randomBytes(12).toString('hex')
  const ccn = randomBytes(12).toString('hex')

  const prisma = _prisma as PrismaClient

  await prisma.user.create({
    data: {
      id: userId1,
      referralId,
      posts: {
        create: [
          {
            id: postId1,
            title: 'Hello World 1',
          },
          {
            id: postId2,
            title: 'Hello World 2',
          },
          {
            id: postId3,
            title: 'Hello World 3',
          },
        ],
      },
      payment: {
        create: {
          ccn,
        },
      },
    },
  })

  await prisma.profile.create({
    data: {
      id: profileId,
      userId: userId1,
      alias: 'john',
      email: 'john@doe.io',
    },
  })

  return {
    userId: userId1,
    postId1,
    postId2,
    profileId,
    ccn,
  }
}
