// @ts-ignore
import type { PrismaClient } from '@prisma/client'

// @ts-ignore
import { Providers } from '../../_utils/providers'
import testMatrix from './_matrix'

declare let prisma: PrismaClient

testMatrix.setupTestSuite(
  ({ driverAdapter, provider }) => {
    testIf(driverAdapter === 'js_d1' && provider === Providers.SQLITE)(
      'should not throw error when using d1 adapter and creating with string field that contains date string',
      async () => {
        const result = await prisma.user.create({
          data: {
            memo: 'This is user input, 2024-10-09T16:05:08.547Z ',
          },
        })

        expect(result.memo).toEqual('This is user input, 2024-10-09T16:05:08.547Z ')
      },
    )
  },
  {
    optOut: {
      from: ['postgresql', 'mysql', 'mongodb', 'cockroachdb', 'sqlserver'],
      reason: 'This is a SQLite specific test',
    },
    skipDriverAdapter: {
      from: ['js_libsql'],
      reason: 'This is a js_d1 specific test',
    },
  },
)
