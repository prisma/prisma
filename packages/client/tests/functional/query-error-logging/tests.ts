import { faker } from '@faker-js/faker'

import { LogEvent } from '../../../src/runtime/getPrismaClient'
import { NewPrismaClient } from '../_utils/types'
import testMatrix from './_matrix'
// @ts-ignore
import type { PrismaClient } from './generated/prisma/client'

let prisma: PrismaClient
declare const newPrismaClient: NewPrismaClient<PrismaClient, typeof PrismaClient>

const email = faker.internet.email()

testMatrix.setupTestSuite(
  () => {
    const errors: LogEvent[] = []

    beforeAll(() => {
      prisma = newPrismaClient({ log: [{ emit: 'event', level: 'error' }] })
      // @ts-expect-error - client not typed for log opts for cross generator compatibility - can be improved once we drop the prisma-client-js generator
      prisma.$on('error', (e) => errors.push(e))
    })

    afterEach(() => {
      errors.length = 0
    })

    test('findUniqueOrThrown when error thrown', async () => {
      await expect(() =>
        prisma.user.findUniqueOrThrow({
          where: {
            email,
          },
        }),
      ).rejects.toMatchObject({
        name: 'PrismaClientKnownRequestError',
        code: 'P2025',
      })

      expect(errors).toHaveLength(1)

      const errorEvent = errors[0]
      expect(errorEvent.message).toContain(
        'An operation failed because it depends on one or more records that were required but not found. No record was found for a query.',
      )
      expect(errorEvent.target).toContain('user.findUniqueOrThrow')
    })

    test('findFirstOrThrow when error thrown', async () => {
      await expect(() =>
        prisma.user.findFirstOrThrow({
          where: {
            email,
          },
        }),
      ).rejects.toMatchObject({
        name: 'PrismaClientKnownRequestError',
        code: 'P2025',
      })

      expect(errors).toHaveLength(1)

      const errorEvent = errors[0]
      expect(errorEvent.message).toContain(
        'An operation failed because it depends on one or more records that were required but not found. No record was found for a query.',
      )
      expect(errorEvent.target).toContain('user.findFirstOrThrow')
    })
  },
  {
    skipDefaultClientInstance: true,
  },
)
