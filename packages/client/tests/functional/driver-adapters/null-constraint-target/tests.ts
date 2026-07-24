import { Providers } from '../../_utils/providers'
import testMatrix from './_matrix'
// @ts-ignore
import type { PrismaClient } from './generated/prisma/client'

declare let prisma: PrismaClient

testMatrix.setupTestSuite(
  () => {
    test('P2011 names the violating column, sourced from error.column', async () => {
      // Force a NOT NULL violation by omitting the required `title` field.
      // For 23502 errors PostgreSQL sets `error.column`; the pg adapter reads it
      // (instead of the unparseable `error.detail`) so the column surfaces in the
      // rendered P2011 message.
      const result = (prisma.article as any).create({ data: {} })

      await expect(result).rejects.toMatchObject({
        name: 'PrismaClientKnownRequestError',
        code: 'P2011',
        message: expect.stringContaining('title'),
      })
    })
  },
  {
    skipDefaultClientInstance: false,
    optOut: {
      from: [Providers.MYSQL, Providers.SQLITE, Providers.SQLSERVER, Providers.MONGODB, Providers.COCKROACHDB],
      reason: 'Tests pg-specific NOT NULL error mapping via error.column',
    },
    skip(when, { clientEngineExecutor }) {
      when(clientEngineExecutor === 'remote', 'Driver adapter error mapping is exercised through the local executor')
    },
  },
)
