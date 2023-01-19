import { faker } from '@faker-js/faker'

import { NewPrismaClient } from '../_utils/types'
import testMatrix from './_matrix'
// @ts-ignore
import type { PrismaClient } from './node_modules/@prisma/client'

const id1 = faker.database.mongodbObjectId()
const id2 = faker.database.mongodbObjectId()

declare let newPrismaClient: NewPrismaClient<typeof PrismaClient>

testMatrix.setupTestSuite(
  (suiteConfig, suiteMeta) => {
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

      expect(queriesExecuted).toBe(1)
    })

    test('does not batch different models', async () => {
      await Promise.all([
        prisma.user.findUnique({ where: { id: id1 } }),
        prisma.post.findUnique({ where: { id: id2 } }),
      ])

      expect(queriesExecuted).toBe(2)
    })

    test('does not batch different where', async () => {
      await Promise.all([
        prisma.user.findUnique({ where: { id: id1 } }),
        prisma.user.findUnique({ where: { email: 'user@example.com' } }),
      ])

      expect(queriesExecuted).toBe(2)
    })

    test('does not batch different select', async () => {
      await Promise.all([
        prisma.user.findUnique({ where: { id: id1 }, select: { id: true } }),
        prisma.user.findUnique({ where: { id: id2 } }),
      ])

      expect(queriesExecuted).toBe(2)
    })
  },
  {
    skipDefaultClientInstance: true,
  },
)
