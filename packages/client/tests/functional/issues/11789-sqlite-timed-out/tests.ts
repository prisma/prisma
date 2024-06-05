import { faker } from '@faker-js/faker'

import { Providers } from '../../_utils/providers'
import testMatrix from './_matrix'
// @ts-ignore
import type { PrismaClient } from './node_modules/@prisma/client'

declare let prisma: PrismaClient

/**
 * Tests for:
 * - https://github.com/prisma/prisma/issues/11789
 * - https://github.com/prisma/prisma/issues/21772
 */
testMatrix.setupTestSuite(({ provider }) => {
  test('2 concurrent upsert should succeed', async () => {
    const id1 = faker.database.mongodbObjectId()
    const id2 = faker.database.mongodbObjectId()

    // User 1
    await prisma.user.create({
      data: {
        id: id1,
        email: `${id1}@example.ext`,
      },
    })
    // User 2
    await prisma.user.create({
      data: {
        id: id2,
        email: `${id2}@example.ext`,
      },
    })

    //
    // Note: it works as a transaction
    // const queries = await prisma.$transaction([
    //
    const queries = Promise.all([
      // Profile 1
      prisma.profile.upsert({
        update: {},
        where: {
          id: id1,
        },
        create: {
          user: {
            connect: {
              id: id1,
            },
          },
        },
      }),
      // Profile 2
      prisma.profile.upsert({
        update: {},
        where: {
          id: id2,
        },
        create: {
          user: {
            connect: {
              id: id2,
            },
          },
        },
      }),
    ])

    await expect(queries).resolves.toHaveLength(2)
  })

  test('2 concurrent delete should succeed', async () => {
    const id1 = faker.database.mongodbObjectId()
    const id2 = faker.database.mongodbObjectId()

    // User 1
    await prisma.user.create({
      data: {
        id: id1,
        email: `${id1}@example.ext`,
      },
    })
    // User 2
    await prisma.user.create({
      data: {
        id: id2,
        email: `${id2}@example.ext`,
      },
    })

    const queries = Promise.all([
      // User 1
      prisma.user.delete({
        where: {
          id: id1,
        },
      }),
      // User 2
      prisma.user.delete({
        where: {
          id: id2,
        },
      }),
    ])

    await expect(queries).resolves.toHaveLength(2)
  })

  // Testing only on SQLite, to avoid overloading the CI with too many queries
  testIf([Providers.SQLITE].includes(provider))('100 concurrent creates should succeed', async () => {
    const N = 100
    const ids = Array.from({ length: N }).map((_, i) => `${i + 1}`.padStart(5, '0'))

    const users = await Promise.all(
      ids.map((id) =>
        prisma.user.create({
          data: {
            id,
            email: `email@${id}`,
          },
        }),
      ),
    )

    expect(users).toHaveLength(N)

    const queries = await Promise.all(
      ids.map((id) =>
        prisma.profile.create({
          data: {
            user: {
              connect: {
                id,
              },
            },
          },
        }),
      ),
    )

    expect(queries).toHaveLength(N)
  })
})
