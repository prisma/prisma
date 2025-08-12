import { copycat, faker } from '@snaplet/copycat'

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
  () => {
    let prisma: PrismaClient
    let queriesExecuted = 0

    beforeAll(async () => {
      prisma = newPrismaClient({
        log: [{ emit: 'event', level: 'query' }],
      })

      await prisma.user.create({ data: { posts: { create: {} }, ...user1 } })
      await prisma.user.create({ data: user2 })

      // @ts-expect-error - client not typed for log opts for cross generator compatibility - can be improved once we drop the prisma-client-js generator
      prisma.$on('query', ({ query }: Prisma.QueryEvent) => {
        // TODO(query compiler): compacted batches don't need to be wrapped in transactions
        if (query.includes('BEGIN') || query.includes('COMMIT') || query.includes('ROLLBACK')) {
          return
        }
        queriesExecuted++
      })
    })

    beforeEach(() => {
      queriesExecuted = 0
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
  },
  {
    skipDefaultClientInstance: true,
  },
)
