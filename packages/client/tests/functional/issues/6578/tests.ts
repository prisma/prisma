import { QueryEvent } from '../../../../src/runtime/getPrismaClient'
import { Providers } from '../../_utils/providers'
import { waitFor } from '../../_utils/tests/waitFor'
import { NewPrismaClient } from '../../_utils/types'
import testMatrix from './_matrix'
// @ts-ignore
import type { PrismaClient } from './generated/prisma/client'

declare const newPrismaClient: NewPrismaClient<PrismaClient, typeof PrismaClient>

// https://github.com/prisma/prisma/issues/6578
testMatrix.setupTestSuite(
  ({ provider }) => {
    let _prisma: ReturnType<typeof newPrismaClient>

    beforeAll(() => {
      _prisma = newPrismaClient({
        log: [
          {
            emit: 'event',
            level: 'query',
          },
        ],
      })
    })

    afterAll(async () => {
      await _prisma.$disconnect()
    })

    // TODO Planetscale InvalidArgument desc = Incorrect time value: '2023-09-30T03:07:55.276+00:00
    test('should assert Dates, DateTimes, Times and UUIDs are wrapped in quotes and are deserializable', async () => {
      const date = new Date()

      let paramsString = ''
      // @ts-expect-error - client not typed for log opts for cross generator compatibility - can be improved once we drop the prisma-client-js generator
      _prisma.$on('query', (e) => {
        const event = e as unknown as QueryEvent
        if (event.query.includes('INSERT')) {
          paramsString = event.params
        }
      })

      if (provider === Providers.SQLITE) {
        await _prisma.user.create({
          // @ts-test-if: provider === Providers.SQLITE
          data: {
            dateTime: date,
          },
        })
      } else {
        await _prisma.user.create({
          data: {
            dateTime: date,
            // @ts-test-if: provider !== Providers.SQLITE
            date: date,
            time: date,
          },
        })
      }

      await waitFor(() => {
        if (paramsString === '') {
          throw new Error('params not received from query logs')
        }
      })

      // This test is asserting that JSON.parse does not throw because quotes are used
      const params = JSON.parse(paramsString)

      if (provider === Providers.SQLITE) {
        expect(params).toHaveLength(3)
      } else {
        expect(params).toHaveLength(5)
      }

      params.forEach((param) => {
        const isString = typeof param === 'string'
        expect(isString).toEqual(true)
      })
    })
  },
  {
    optOut: {
      from: [Providers.MONGODB],
      reason: 'Params not applicable to mongodb',
    },
  },
)
