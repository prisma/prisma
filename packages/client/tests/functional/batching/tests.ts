import { faker } from '@faker-js/faker'

import { Providers } from '../_utils/providers'
import { waitFor } from '../_utils/tests/waitFor'
import { NewPrismaClient } from '../_utils/types'
import testMatrix from './_matrix'
// @ts-ignore
import type { PrismaClient } from './node_modules/@prisma/client'

const id1 = faker.database.mongodbObjectId()
const id2 = faker.database.mongodbObjectId()

declare let newPrismaClient: NewPrismaClient<typeof PrismaClient>

testMatrix.setupTestSuite(
  ({ provider }) => {
    let prisma: PrismaClient<{ log: [{ emit: 'event'; level: 'query' }] }>
    let queriesExecuted = 0

    beforeAll(() => {
      prisma = newPrismaClient({
        log: [{ emit: 'event', level: 'query' }],
      })

      prisma.$on('query', () => queriesExecuted++)
    })

    beforeEach(() => {
      queriesExecuted = 0
    })

    test('batches findUnique', async () => {
      await Promise.all([
        prisma.user.findUnique({ where: { id: id1 } }),
        prisma.user.findUnique({ where: { id: id2 } }),
      ])

      await waitFor(() => {
        expect(queriesExecuted).toBe(1)
      })
    })

    test('batches findUniqueOrThrow', async () => {
      await Promise.allSettled([
        prisma.user.findUniqueOrThrow({ where: { id: id1 } }),
        prisma.user.findUniqueOrThrow({ where: { id: id2 } }),
      ])

      await waitFor(() => {
        expect(queriesExecuted).toBe(1)
      })
    })

    test('does not batch different models', async () => {
      await Promise.all([
        prisma.user.findUnique({ where: { id: id1 } }),
        prisma.post.findUnique({ where: { id: id2 } }),
      ])

      // binary engine can retry requests sometimes, that's why we
      // can't know for sure how many queries will be logged. All we
      // know is that it should not be 1 query in any case
      await waitFor(() => expect(queriesExecuted).toBeGreaterThan(1))
    })

    test('does not batch different where', async () => {
      await Promise.all([
        prisma.user.findUnique({ where: { id: id1 } }),
        prisma.user.findUnique({ where: { email: 'user@example.com' } }),
      ])

      await waitFor(() => expect(queriesExecuted).toBeGreaterThan(1))
    })

    test('does not batch different select', async () => {
      await Promise.all([
        prisma.user.findUnique({ where: { id: id1 }, select: { id: true } }),
        prisma.user.findUnique({ where: { id: id2 } }),
      ])

      await waitFor(() => expect(queriesExecuted).toBeGreaterThan(1))
    })

    testIf(provider === Providers.POSTGRESQL)(
      'interactive transactions: batches findUnique for a single model',
      async () => {
        const u1 = await prisma.user.create({
          data: {
            email: `user1-${faker.string.uuid()}@example.com`,
          },
        })
        const u2 = await prisma.user.create({
          data: {
            email: `user2-${faker.string.uuid()}@example.com`,
          },
        })

        const ids = [u1.id, u2.id]

        await prisma.$transaction((tx) => {
          return Promise.all(ids.map((id) => tx.user.findUnique({ where: { id } }).posts()))
        })

        await waitFor(() => {
          // 2 queries for inserting the users
          // 2 queries for BEGIN and COMMIT
          // 2 queries for finding the posts
          expect(queriesExecuted).toBe(6)
        })
      },
    )

    testIf(provider === Providers.POSTGRESQL)(
      'interactive transactions: batches findUnique for multiple models',
      async () => {
        const u1 = await prisma.user.create({
          data: {
            email: `user1-${faker.string.uuid()}@example.com`,
          },
        })
        const u2 = await prisma.user.create({
          data: {
            email: `user2-${faker.string.uuid()}@example.com`,
          },
        })

        const ids = [u1.id, u2.id]

        await prisma.$transaction((tx) => {
          return Promise.all([
            ...ids.map((id) => tx.user.findUnique({ where: { id } }).posts()),
            ...ids.map((id) => tx.user.findUnique({ where: { id } }).comments()),
          ])
        })

        await waitFor(() => {
          // 2 queries for inserting the users
          // 2 queries for BEGIN and COMMIT
          // 2 queries for finding the posts
          // 2 queries for finding the comments
          expect(queriesExecuted).toBe(8)
        })
      },
    )
  },
  {
    skipDefaultClientInstance: true,
  },
)
