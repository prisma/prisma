import { randomBytes } from 'crypto'

import testMatrix from './_matrix'
// @ts-ignore
import type { PrismaClient } from './node_modules/@prisma/client'

declare let prisma: PrismaClient

testMatrix.setupTestSuite(() => {
  test('create with connect 1 unique (PK)', async () => {
    const userId = randomBytes(12).toString('hex')
    const userReferralId = randomBytes(12).toString('hex')
    await prisma.user.create({
      data: {
        id: userId,
        referralId: userReferralId,
      },
    })

    await prisma.post.create({
      data: {
        title: 'Hello World 1',
        author: {
          connect: {
            id: userId,
          },
        },
      },
    })

    const user = await prisma.user.findUnique({
      where: {
        id: userId,
      },
      include: {
        profile: true,
      },
    })

    expect(user?.profile).toBeTruthy()
  })

  test('create with connect 2 uniques (PK & non-PK)', async () => {
    const userId = randomBytes(12).toString('hex')
    const userReferralId = randomBytes(12).toString('hex')
    await prisma.user.create({
      data: {
        id: userId,
        referralId: userReferralId,
      },
    })

    await prisma.post.create({
      data: {
        title: 'Hello World 2',
        author: {
          connect: {
            id: userId,
            referralId: userReferralId,
          },
        },
      },
    })

    const user = await prisma.user.findUnique({
      where: {
        id: userId,
      },
      include: {
        profile: true,
      },
    })

    expect(user?.profile).toBeTruthy()
  })

  test('create with connect 1 unique (non-PK)', async () => {
    const userId = randomBytes(12).toString('hex')
    const userReferralId = randomBytes(12).toString('hex')
    await prisma.user.create({
      data: {
        id: userId,
        referralId: userReferralId,
      },
    })

    await prisma.post.create({
      data: {
        title: 'Hello World 3',
        author: {
          connect: {
            referralId: userReferralId,
          },
        },
      },
    })

    const user = await prisma.user.findUnique({
      where: {
        id: userId,
      },
      include: {
        profile: true,
      },
    })

    expect(user?.profile).toBeTruthy()
  })
})
