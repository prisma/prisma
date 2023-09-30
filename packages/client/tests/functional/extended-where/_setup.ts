import { copycat } from '@snaplet/copycat'

// @ts-ignore
import type { PrismaClient } from './node_modules/@prisma/client'

export async function setup(_prisma: unknown) {
  const userId1 = copycat.uuid(1).replaceAll('-', '').slice(-24)
  const referralId = copycat.uuid(2).replaceAll('-', '').slice(-24)
  const postId1 = `01${copycat.uuid(3).replaceAll('-', '').slice(-26)}`
  const postId2 = `02${copycat.uuid(4).replaceAll('-', '').slice(-26)}`
  const postId3 = `03${copycat.uuid(5).replaceAll('-', '').slice(-26)}`
  const profileId = copycat.uuid(6).replaceAll('-', '').slice(-24)
  const ccn = copycat.uuid(7).replaceAll('-', '').slice(-24)

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
