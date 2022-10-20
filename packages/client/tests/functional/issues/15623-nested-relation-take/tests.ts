import { NewPrismaClient } from '../../_utils/types'
import { waitFor } from '../../_utils/waitFor'
import testMatrix from './_matrix'
// @ts-ignore
import type { PrismaClient } from './node_modules/@prisma/client'

let prisma: PrismaClient<{ log: [{ level: 'query'; emit: 'event' }] }>
declare let newPrismaClient: NewPrismaClient<typeof PrismaClient>

testMatrix.setupTestSuite(
  (suiteConfig, suiteMeta) => {
    beforeAll(async () => {
      prisma = newPrismaClient({ log: [{ level: 'query', emit: 'event' }] })

      await prisma.user.create({
        data: {
          posts: {
            create: [{ title: 'A' }, { title: 'B' }, { title: 'C' }],
          },
        },
      })
    })

    test('example', async () => {
      let lcQuery: string
      prisma.$on('query', (e) => {
        lcQuery = e.query.toLowerCase()
      })

      await prisma.user.findFirst({
        include: {
          posts: {
            take: 2,
          },
        },
      })

      await waitFor(() => {
        expect(lcQuery).toMatch(/.*?limit.*?/)
      })
    })
  },
  {
    skipDefaultClientInstance: true,
  },
)
