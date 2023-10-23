import { QueryEvent } from '../../../../src/runtime/getPrismaClient'
import { ProviderFlavors } from '../../_utils/providers'
import { NewPrismaClient } from '../../_utils/types'
import testMatrix from './_matrix'
// @ts-ignore
import type { PrismaClient } from './node_modules/@prisma/client'

declare let newPrismaClient: NewPrismaClient<typeof PrismaClient>

// https://github.com/prisma/prisma/issues/6578
testMatrix.setupTestSuite(
  ({ provider, providerFlavor }) => {
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

    // TODO LIBSQL SyntaxError: Unexpected end of JSON input on CI, does not fail locally, needs investigation
    // TODO Planetscale InvalidArgument desc = Incorrect time value: '2023-09-30T03:07:55.276+00:00
    skipTestIf(providerFlavor === ProviderFlavors.JS_LIBSQL || providerFlavor === ProviderFlavors.JS_PLANETSCALE)(
      'should assert Dates, DateTimes, Times and UUIDs are wrapped in quotes and are deserializable',
      async () => {
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
      },
    )
  },
  {
    optOut: {
      from: ['mongodb'],
      reason: 'Params not applicable to mongodb',
    },
    skipProviderFlavor: {
      from: ['js_neon', 'js_pg'],
      reason:
        "Something seems to the off with date serialization. invalid input syntax for type time: '2023-09-23T00:04:18.068+00:00'",
    },
  },
)
