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
        payment: { create: {} },
      },
    })

    await prisma.profile.create({
      data: {
        alias: 'john1',
        email: 'john1@doe.io',
        user: {
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
        payment: {
          create: {},
        },
      },
    })

    await prisma.profile.create({
      data: {
        alias: 'john2',
        email: 'john2@doe.io',
        user: {
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
        payment: { create: {} },
      },
    })

    await prisma.profile.create({
      data: {
        alias: 'john3',
        email: 'john3@doe.io',
        user: {
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
