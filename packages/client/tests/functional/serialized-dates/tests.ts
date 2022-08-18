import { NewPrismaClient } from '../_utils/types'
import testMatrix from './_matrix'

// @ts-ignore this is just for type checks
type PrismaClient = import('@prisma/client').PrismaClient
// @ts-ignore this is just for type checks
declare let newPrismaClient: NewPrismaClient<typeof PrismaClient>

testMatrix.setupTestSuite(
  ({ provider }) => {
    // @ts-ignore
    let _prisma: PrismaClient

    beforeAll(async () => {
      _prisma = newPrismaClient({
        log: [
          {
            emit: 'event',
            level: 'query',
          },
        ],
      })

      await _prisma.$connect()
    })

    afterAll(async () => {
      await _prisma.$disconnect()
    })

    test('should assert Dates, DateTimes, Times and UUIDs are wrapped in quotes and are deserializable', async () => {
      const date = new Date()

      let paramsString = ''
      _prisma.$on('query' as any, (e) => {
        if (e.query.includes('INSERT')) {
          paramsString = e.params
        }
      })

      await _prisma.user.create({
        data: {
          dateTime: date,
          ...(provider !== 'sqlite'
            ? {
                date: date,
                time: date,
              }
            : {}),
        },
      })

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
  },
)
