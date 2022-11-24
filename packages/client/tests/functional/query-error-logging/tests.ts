import { faker } from '@faker-js/faker'
// @ts-ignore
import type { PrismaClient } from '@prisma/client'

import { NotFoundError } from '../../../src/runtime'
import { LogEvent } from '../../../src/runtime/getPrismaClient'
import { NewPrismaClient } from '../_utils/types'
import testMatrix from './_matrix'

let prisma: PrismaClient<{ log: [{ emit: 'event'; level: 'error' }] }>
declare let newPrismaClient: NewPrismaClient<typeof PrismaClient>

const email = faker.internet.email()

testMatrix.setupTestSuite(
  () => {
    const errors: LogEvent[] = []

    beforeAll(() => {
      prisma = newPrismaClient({ log: [{ emit: 'event', level: 'error' }] })
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
      ).rejects.toThrowError(new NotFoundError('No User found'))

      expect(errors).toHaveLength(1)

      const errorEvent = errors[0]
      expect(errorEvent.message).toContain(
        'An operation failed because it depends on one or more records that were required but not found. Expected a record, found none.',
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
      ).rejects.toThrowError(new NotFoundError('No User found'))

      expect(errors).toHaveLength(1)

      const errorEvent = errors[0]
      expect(errorEvent.message).toContain(
        'An operation failed because it depends on one or more records that were required but not found. Expected a record, found none.',
      )
      expect(errorEvent.target).toContain('user.findFirstOrThrow')
    })
  },
  {
    skipDefaultClientInstance: true,
  },
)
