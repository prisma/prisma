import { QueryEvent } from '../../../../src/runtime/getPrismaClient'
import { NewPrismaClient } from '../../_utils/types'
import testMatrix from './_matrix'
// @ts-ignore
import type { PrismaClient } from './node_modules/@prisma/client'

declare let newPrismaClient: NewPrismaClient<typeof PrismaClient>

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

    test('should assert Dates, DateTimes, Times and UUIDs are wrapped in quotes and are deserializable', async () => {
      const date = new Date()

      let paramsString = ''
      _prisma.$on('query', (e) => {
        const event = e as unknown as QueryEvent
        if (event.query.includes('INSERT')) {
          paramsString = event.params
        }
      })

      if (provider === 'sqlite') {
        await _prisma.user.create({
          // @ts-test-if: provider === 'sqlite'
          data: {
            dateTime: date,
          },
        })
      } else {
        await _prisma.user.create({
          data: {
            dateTime: date,
            // @ts-test-if: provider !== 'sqlite'
            date: date,
            time: date,
          },
        })
      }

      // This test is asserting that JSON.parse does not throw because quotes are used
      const params = JSON.parse(paramsString)

      if (provider === 'sqlite') {
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
      from: ['mongodb'],
      reason: 'Params not applicable to mongodb',
    },
    skipDataProxy: {
      runtimes: ['node', 'edge'],
      reason: 'Query logs are not supported for Data Proxy yet',
    },
  },
)
