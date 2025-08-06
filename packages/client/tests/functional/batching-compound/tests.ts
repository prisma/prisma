import { copycat } from '@snaplet/copycat'

import { waitFor } from '../_utils/tests/waitFor'
import { NewPrismaClient } from '../_utils/types'
import testMatrix from './_matrix'
// @ts-ignore
import type { PrismaClient } from './generated/prisma/client'

const user1 = {
  firstName: copycat.firstName(1),
  lastName: copycat.lastName(1),
}
const user2 = {
  firstName: copycat.firstName(2),
  lastName: copycat.lastName(2),
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

      await prisma.user.createMany({
        data: [user1, user2],
      })

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

    test('batches findUnique with a compound ID', async () => {
      const res = await Promise.all([
        prisma.user.findUnique({
          where: { firstName_lastName: { firstName: user1.firstName, lastName: user1.lastName } },
        }),
        prisma.user.findUnique({
          where: { firstName_lastName: { firstName: user2.firstName, lastName: user2.lastName } },
        }),
      ])

      await waitFor(() => {
        expect(queriesExecuted).toBe(1)
        expect(res).toMatchObject([user1, user2])
      })
    })

    test('batches repeated findUnique with a compound ID with same row correctly', async () => {
      const res = await Promise.all([
        prisma.user.findUnique({
          where: { firstName_lastName: { firstName: user1.firstName, lastName: user1.lastName } },
        }),
        prisma.user.findUnique({
          where: { firstName_lastName: { firstName: user1.firstName, lastName: user1.lastName } },
        }),
      ])

      await waitFor(() => {
        expect(queriesExecuted).toBe(1)
        expect(res).toMatchObject([user1, user1])
      })
    })

    test('batches findUniqueOrThrow with a compound ID with an error', async () => {
      const res = await Promise.allSettled([
        prisma.user.findUniqueOrThrow({
          where: { firstName_lastName: { firstName: user1.firstName, lastName: user1.lastName } },
        }),
        prisma.user.findUniqueOrThrow({
          where: { firstName_lastName: { firstName: 'non-existing', lastName: 'user' } },
        }),
        prisma.user.findUniqueOrThrow({
          where: { firstName_lastName: { firstName: user2.firstName, lastName: user2.lastName } },
        }),
      ])

      await waitFor(() => {
        expect(queriesExecuted).toBe(1)
        expect(res).toMatchObject([
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
  },
  {
    skipDefaultClientInstance: true,
  },
)
