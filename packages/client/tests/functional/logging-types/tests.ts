import { Providers } from '../_utils/providers'
import { waitFor } from '../_utils/tests/waitFor'
import type { NewPrismaClient } from '../_utils/types'
import testMatrix from './_matrix'
// @ts-ignore
import type { Prisma, PrismaClient } from './node_modules/@prisma/client'

declare let newPrismaClient: NewPrismaClient<typeof PrismaClient>

testMatrix.setupTestSuite(
  ({ provider }, _suiteMeta, clientMeta) => {
    test('check that query and info logs match their declared types', async () => {
      const prisma: PrismaClient<Prisma.PrismaClientOptions, 'query' | 'info'> = newPrismaClient({
        log: [
          {
            emit: 'event',
            level: 'query',
          },
          {
            emit: 'event',
            level: 'info',
          },
        ],
      })

      const queryLogs: Prisma.QueryEvent[] = []
      prisma.$on('query', (event) => queryLogs.push(event))

      const infoLogs: Prisma.LogEvent[] = []
      prisma.$on('info', (event) => infoLogs.push(event))

      await prisma.user.findMany()

      await waitFor(() => {
        // A query log should always be present.
        expect(queryLogs.length).toBeGreaterThan(0)

        // We always have at least one quaint log item with native Rust SQL connectors,
        // and the API calls related logs with Data Proxy, but with driver adapters and
        // with MongoDB there might not necessarily be any info logs in this test.
        if (!clientMeta.driverAdapter && !(provider === Providers.MONGODB && !clientMeta.dataProxy)) {
          expect(infoLogs.length).toBeGreaterThan(0)
        }
      })

      for (const log of queryLogs) {
        expect(log.timestamp).toBeInstanceOf(Date)
        expect(typeof log.query).toBe('string')
        expect(typeof log.params).toBe('string')
        expect(typeof log.duration).toBe('number')
        expect(typeof log.target).toBe('string')
      }

      for (const log of infoLogs) {
        expect(log.timestamp).toBeInstanceOf(Date)
        expect(typeof log.target).toBe('string')
        expect(typeof log.message).toBe('string')
      }
    })
  },
  {
    skipDefaultClientInstance: true,
  },
)
