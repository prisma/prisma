import { NewPrismaClient } from '../../_utils/types'
import testMatrix from './_matrix'
// @ts-ignore
import type { PrismaClient } from './node_modules/@prisma/client'

declare let newPrismaClient: NewPrismaClient<typeof PrismaClient>

testMatrix.setupTestSuite(
  () => {
    let client: PrismaClient

    afterAll(async () => {
      await client.$disconnect()
    })

    test('should log queries', async () => {
      client = newPrismaClient({
        log: [
          {
            emit: 'event',
            level: 'query',
          },
        ],
      })

      const queryLogPromise = ((): Promise<any> =>
        new Promise((resolve) => {
          // @ts-expect-error
          client.$on('query', (data) => {
            if ('query' in data) {
              resolve(data)
            }
          })
        }))()

      await client.user.findMany()
      const queryLog = await queryLogPromise

      expect(queryLog.query).toMatchInlineSnapshot('db.User.aggregate([ { $project: { _id: 1, }, }, ])')
    })
  },
  {
    optOut: {
      from: ['cockroachdb', 'mysql', 'postgresql', 'sqlite', 'sqlserver'],
      reason: 'Only testing MongoDB provider(s) to replicate this issue',
    },
    skipDataProxy: {
      runtimes: ['edge', 'node'],
      reason: 'https://github.com/prisma/mini-proxy/pull/35',
    },
    skipDefaultClientInstance: true
  },
)
