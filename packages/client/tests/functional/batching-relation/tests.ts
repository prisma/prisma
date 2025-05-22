import { copycat } from '@snaplet/copycat'

import { waitFor } from '../_utils/tests/waitFor'
import { NewPrismaClient } from '../_utils/types'
import testMatrix from './_matrix'
// @ts-ignore
import type { PrismaClient } from './generated/prisma/client'

const artist1 = copycat.fullName(1)
const artist2 = copycat.fullName(2)

const album1 = copycat.streetName(1)
const album2 = copycat.streetName(2)

declare let newPrismaClient: NewPrismaClient<typeof PrismaClient>

testMatrix.setupTestSuite(
  () => {
    let prisma: PrismaClient<{ log: [{ emit: 'event'; level: 'query' }] }>
    let queriesExecuted = 0

    beforeAll(async () => {
      prisma = newPrismaClient({
        log: [{ emit: 'event', level: 'query' }],
      })

      await prisma.artist.create({ data: { name: artist1, albums: { create: { title: album1 } } } })
      await prisma.artist.create({ data: { name: artist2, albums: { create: { title: album2 } } } })

      prisma.$on('query', () => queriesExecuted++)
    })

    beforeEach(() => {
      queriesExecuted = 0
    })

    test('batches findUnique that includes a relation', async () => {
      const res = await Promise.all([
        prisma.artist.findUnique({ where: { name: artist1 }, include: { albums: true } }),
        prisma.artist.findUnique({ where: { name: artist2 }, include: { albums: true } }),
      ])

      await waitFor(() => {
        expect(queriesExecuted).toBe(2)
        expect(res).toMatchObject([
          { name: artist1, albums: [{ title: album1 }] },
          { name: artist2, albums: [{ title: album2 }] },
        ])
      })
    })

    test('does not batch findFirst that includes a relation', async () => {
      const res = await Promise.all([
        prisma.artist.findFirst({ where: { name: artist1 }, include: { albums: true } }),
        prisma.artist.findFirst({ where: { name: artist2 }, include: { albums: true } }),
      ])

      await waitFor(() => {
        expect(queriesExecuted).toBe(4)
        expect(res).toMatchObject([
          { name: artist1, albums: [{ title: album1 }] },
          { name: artist2, albums: [{ title: album2 }] },
        ])
      })
    })

    test('batches findUniqueOrThrow that includes a relation with an error', async () => {
      const res = await Promise.allSettled([
        prisma.artist.findUniqueOrThrow({ where: { name: artist1 }, include: { albums: true } }),
        prisma.artist.findUniqueOrThrow({ where: { name: 'non-existing' }, include: { albums: true } }),
        prisma.artist.findUniqueOrThrow({ where: { name: artist2 }, include: { albums: true } }),
      ])

      await waitFor(() => {
        expect(queriesExecuted).toBe(2)
        expect(res).toMatchObject([
          { status: 'fulfilled', value: { name: artist1, albums: [{ title: album1 }] } },
          {
            status: 'rejected',
            reason: expect.objectContaining({
              message: expect.stringContaining(
                'An operation failed because it depends on one or more records that were required but not found',
              ),
            }),
          },
          { status: 'fulfilled', value: { name: artist2, albums: [{ title: album2 }] } },
        ])
      })
    })
  },
  {
    skipDefaultClientInstance: true,
  },
)
