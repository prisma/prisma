import { copycat, faker } from '@snaplet/copycat'

import { Providers } from '../_utils/providers'
import { waitFor } from '../_utils/tests/waitFor'
import { NewPrismaClient } from '../_utils/types'
import testMatrix from './_matrix'
// @ts-ignore
import type { PrismaClient } from './generated/prisma/client'

const user1 = {
  id: faker.database.mongodbObjectId(),
  email: copycat.email(1),
}
const user2 = {
  id: faker.database.mongodbObjectId(),
  email: copycat.email(2),
}

declare const newPrismaClient: NewPrismaClient<PrismaClient, typeof PrismaClient>

testMatrix.setupTestSuite(
  ({ provider }) => {
    let prisma: PrismaClient
    let queriesExecuted = 0
    let beginCount = 0
    let commitCount = 0
    let rollbackCount = 0
    let savepointCount = 0
    let releaseSavepointCount = 0
    let rollbackToSavepointCount = 0

    function resetQueryCounts() {
      queriesExecuted = 0
      beginCount = 0
      commitCount = 0
      rollbackCount = 0
      savepointCount = 0
      releaseSavepointCount = 0
      rollbackToSavepointCount = 0
    }

    beforeAll(async () => {
      prisma = newPrismaClient({
        log: [{ emit: 'event', level: 'query' }],
      })

      await prisma.user.create({ data: { posts: { create: {} }, ...user1 } })
      await prisma.user.create({ data: user2 })

      // @ts-expect-error - client not typed for log opts for cross generator compatibility - can be improved once we drop the prisma-client-js generator
      prisma.$on('query', ({ query }: Prisma.QueryEvent) => {
        const normalized = query.trim().toUpperCase()

        // Track transaction boundary statements separately from "real" queries.
        // In qpe=remote mode, BEGIN isn't consistently surfaced in query logs, but COMMIT often is.
        if (normalized.startsWith('BEGIN')) beginCount++
        if (normalized.startsWith('COMMIT')) commitCount++
        if (normalized.startsWith('ROLLBACK TO SAVEPOINT')) rollbackToSavepointCount++
        else if (normalized.startsWith('ROLLBACK')) rollbackCount++
        if (normalized.startsWith('RELEASE SAVEPOINT')) releaseSavepointCount++
        if (normalized.startsWith('SAVEPOINT')) savepointCount++

        // TODO(query compiler): compacted batches don't need to be wrapped in transactions.
        // We exclude transaction boundary statements from the general query count.
        if (
          normalized.startsWith('BEGIN') ||
          normalized.startsWith('COMMIT') ||
          normalized.startsWith('ROLLBACK') ||
          normalized.startsWith('SAVEPOINT') ||
          normalized.startsWith('RELEASE SAVEPOINT') ||
          normalized.startsWith('ROLLBACK TO SAVEPOINT')
        ) {
          return
        }
        queriesExecuted++
      })
    })

    beforeEach(() => {
      resetQueryCounts()
    })

    test('batches findUnique', async () => {
      const res = await Promise.all([
        prisma.user.findUnique({ where: { id: user1.id } }),
        prisma.user.findUnique({ where: { id: user2.id } }),
      ])

      await waitFor(() => {
        expect(queriesExecuted).toBe(1)
        expect(res).toEqual([user1, user2])
      })
    })

    test('batches findUnique (issue 27363)', async () => {
      const first = (async () =>
        await prisma.user.findUnique({ where: { id: user1.id }, select: { posts: { take: 1 } } }))()
      const second = await prisma.user.findUnique({ where: { id: user1.id }, select: { posts: { take: 1 } } })

      await waitFor(async () => {
        expect(await first).toMatchObject({ posts: [{ id: expect.any(String) }] })
        expect(second).toMatchObject({ posts: [{ id: expect.any(String) }] })
      })
    })

    test('batches findUnique with re-ordered selection', async () => {
      const res = await Promise.all([
        prisma.user.findUnique({ where: { id: user1.id }, select: { id: true, email: true } }),
        prisma.user.findUnique({ where: { id: user2.id }, select: { email: true, id: true } }),
      ])

      await waitFor(() => {
        expect(queriesExecuted).toBe(1)
        expect(res).toEqual([user1, user2])
      })
    })

    test('batches repeated findUnique for the same row correctly', async () => {
      const res = await Promise.all([
        prisma.user.findUnique({ where: { id: user1.id } }),
        prisma.user.findUnique({ where: { id: user1.id } }),
      ])

      await waitFor(() => {
        expect(queriesExecuted).toBe(1)
        expect(res).toEqual([user1, user1])
      })
    })

    test('batches findUniqueOrThrow', async () => {
      const res = await Promise.all([
        prisma.user.findUniqueOrThrow({ where: { id: user1.id } }),
        prisma.user.findUniqueOrThrow({ where: { id: user2.id } }),
      ])

      await waitFor(() => {
        expect(queriesExecuted).toBe(1)
        expect(res).toEqual([user1, user2])
      })
    })

    test('batches findUniqueOrThrow with an error', async () => {
      const res = await Promise.allSettled([
        prisma.user.findUniqueOrThrow({ where: { id: user1.id } }),
        prisma.user.findUniqueOrThrow({ where: { id: faker.database.mongodbObjectId() } }),
        prisma.user.findUniqueOrThrow({ where: { id: user2.id } }),
      ])

      await waitFor(() => {
        expect(queriesExecuted).toBe(1)
        expect(res).toEqual([
          { status: 'fulfilled', value: user1 },
          {
            status: 'rejected',
            reason: expect.objectContaining({
              message: expect.stringContaining(
                'An operation failed because it depends on one or more records that were required but not found',
              ),
            }),
          },
          { status: 'fulfilled', value: user2 },
        ])
      })
    })

    test('does not batch different models', async () => {
      await Promise.all([
        prisma.user.findUnique({ where: { id: user1.id } }),
        prisma.post.findUnique({ where: { id: user2.id } }),
      ])

      // binary engine can retry requests sometimes, that's why we
      // can't know for sure how many queries will be logged. All we
      // know is that it should not be 1 query in any case
      await waitFor(() => expect(queriesExecuted).toBeGreaterThan(1))
    })

    test('does not batch different where', async () => {
      await Promise.all([
        prisma.user.findUnique({ where: { id: user1.id } }),
        prisma.user.findUnique({ where: { email: 'user@example.com' } }),
      ])

      await waitFor(() => expect(queriesExecuted).toBeGreaterThan(1))
    })

    test('does not batch different select', async () => {
      await Promise.all([
        prisma.user.findUnique({ where: { id: user1.id }, select: { id: true } }),
        prisma.user.findUnique({ where: { id: user2.id } }),
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

        // Measure only what happens inside the interactive transaction.
        resetQueryCounts()

        await prisma.$transaction((tx) => {
          return Promise.all(ids.map((id) => tx.user.findUnique({ where: { id } }).posts()))
        })

        await waitFor(() => {
          // Ensure batching did not introduce nested transaction boundaries.
          // We expect exactly one top-level commit for the interactive transaction.
          expect(beginCount).toBeLessThanOrEqual(1)
          expect(commitCount).toBe(1)
          expect(rollbackCount).toBe(0)
          expect(savepointCount).toBe(0)
          expect(releaseSavepointCount).toBe(0)
          expect(rollbackToSavepointCount).toBe(0)

          // Transaction work should not require more than one query per user for loading posts.
          // (This allows for future optimizations that reduce query count further.)
          expect(queriesExecuted).toBeLessThanOrEqual(2)
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

        // Measure only what happens inside the interactive transaction.
        resetQueryCounts()

        await prisma.$transaction((tx) => {
          return Promise.all([
            ...ids.map((id) => tx.user.findUnique({ where: { id } }).posts()),
            ...ids.map((id) => tx.user.findUnique({ where: { id } }).comments()),
          ])
        })

        await waitFor(() => {
          // Ensure batching did not introduce nested transaction boundaries.
          expect(beginCount).toBeLessThanOrEqual(1)
          expect(commitCount).toBe(1)
          expect(rollbackCount).toBe(0)
          expect(savepointCount).toBe(0)
          expect(releaseSavepointCount).toBe(0)
          expect(rollbackToSavepointCount).toBe(0)

          // Two users, two related models => should not require more than one query per user per model.
          expect(queriesExecuted).toBeLessThanOrEqual(4)
        })
      },
    )
  },
  {
    skipDefaultClientInstance: true,
  },
)
