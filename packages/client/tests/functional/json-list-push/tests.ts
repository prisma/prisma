import { faker } from '@faker-js/faker'

import testMatrix from './_matrix'
// @ts-ignore
import type { PrismaClient } from './node_modules/@prisma/client'

declare let prisma: PrismaClient
const email = faker.internet.email()

testMatrix.setupTestSuite(
  () => {
    beforeEach(async () => {
      await prisma.user.deleteMany()
      await prisma.user.create({ data: { email } })
    })

    test('push with single element', async () => {
      const result = await prisma.user.update({
        where: { email },
        data: {
          jsons: {
            push: 1,
          },
        },
      })

      expect(result.jsons).toEqual([1])
    })

    test('push with array value', async () => {
      const result = await prisma.user.update({
        where: { email },
        data: {
          jsons: {
            push: [1, 2],
          },
        },
      })

      expect(result.jsons).toEqual([[1, 2]])
    })
  },
  {
    optOut: {
      from: ['sqlite', 'mysql', 'mongodb', 'cockroachdb', 'sqlserver'],
      reason: 'json lists are supported only on postgresql',
    },
  },
)
