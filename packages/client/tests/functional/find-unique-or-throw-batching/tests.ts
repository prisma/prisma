import { faker } from '@faker-js/faker'

import testMatrix from './_matrix'
// @ts-ignore
import type { PrismaClient } from './node_modules/@prisma/client'

class NotFoundError extends Error {}
declare let prisma: PrismaClient

const id = faker.random.alphaNumeric(11)
const missing = faker.random.alphaNumeric(11)

testMatrix.setupTestSuite(
  (suiteConfig, suiteMeta) => {
    beforeEach(async () => {
      await prisma.user.deleteMany()
      await prisma.user.create({
        data: {
          id,
        },
      })
    })

    test('batched errors are serialized properly', async () => {
      const found = prisma.user.findUniqueOrThrow({ where: { id } })
      const foundToo = prisma.user.findUnique({ where: { id } })
      const notFound = prisma.user.findUniqueOrThrow({ where: { id: missing } })
      const result = await Promise.allSettled([found, foundToo, notFound])
      expect(result).toEqual([
        { status: 'fulfilled', value: { id: id } },
        { status: 'fulfilled', value: { id: id } },
        { reason: new NotFoundError('No User found'), status: 'rejected' },
      ])
    })
  },
  {
    optOut: {
      from: ['postgresql', 'mysql', 'mongodb', 'cockroachdb', 'sqlserver'],
      reason:
        'This proves a regresion in the way client handles graphql information coming from the engine, and does not depend on backends',
    },
  },
)
