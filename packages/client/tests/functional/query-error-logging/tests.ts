import { faker } from '@faker-js/faker'

import { LogEvent } from '../../../src/runtime/getPrismaClient'
import { NewPrismaClient } from '../_utils/types'
import testMatrix from './_matrix'
// @ts-ignore
import type { Prisma, PrismaClient } from './generated/prisma/client'

let prisma: PrismaClient<'error', Prisma.PrismaClientOptions['omit']>
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

    // Test for https://github.com/prisma/prisma/issues/16354
    test('middleware captures errors', async () => {
      prisma = newPrismaClient()
      prisma.$use(async (params, next) => {
        try {
          return await next(params)
        } catch (error) {
          expect(params.action).toEqual('findFirstOrThrow')
          throw new Error('Middleware error')
        }
      })

      await expect(() =>
        prisma.user.findFirstOrThrow({
          where: {
            email,
          },
        }),
      ).rejects.toThrow('Middleware error')

      prisma = newPrismaClient()
      prisma.$use(async (params, next) => {
        try {
          return await next(params)
        } catch (error) {
          expect(params.action).toEqual('findUniqueOrThrow')
          throw new Error('Middleware error')
        }
      })

      await expect(() =>
        prisma.user.findUniqueOrThrow({
          where: {
            email,
          },
        }),
      ).rejects.toThrow('Middleware error')
    })
  },
  {
    skipDefaultClientInstance: true,
  },
)
