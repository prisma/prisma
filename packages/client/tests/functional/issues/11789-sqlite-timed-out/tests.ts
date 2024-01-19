import { faker } from '@faker-js/faker'

import { Providers } from '../../_utils/providers'
import testMatrix from './_matrix'
// @ts-ignore
import type { PrismaClient } from './node_modules/@prisma/client'

declare let prisma: PrismaClient

/**
 * tests for #11789
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

    // Only fails for SQLite:
    if (provider === Providers.SQLITE) {
      //     ConnectorError(ConnectorError { user_facing_error: None, kind: ConnectionError(Timed out during query execution.), transient: false })]
      await expect(queries).rejects.toThrow('ConnectionError(Timed out during query execution.)')
    } else {
      await expect(queries).resolves.toHaveLength(2)
    }
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

    // Only fails for SQLite:
    if (provider === Providers.SQLITE) {
      //     ConnectorError(ConnectorError { user_facing_error: None, kind: ConnectionError(Timed out during query execution.), transient: false })]
      await expect(queries).rejects.toThrow('ConnectionError(Timed out during query execution.)')
    } else {
      await expect(queries).resolves.toHaveLength(2)
    }
  })
})
