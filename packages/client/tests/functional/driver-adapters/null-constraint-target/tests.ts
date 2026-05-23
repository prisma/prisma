import { Providers } from '../../_utils/providers'
import testMatrix from './_matrix'
// @ts-ignore
import type { PrismaClient } from './generated/prisma/client'

declare let prisma: PrismaClient

testMatrix.setupTestSuite(
  () => {
    test('P2011: meta.target contains the violating column name', async () => {
      // Force a NOT NULL violation by omitting the required `title` field.
      // The pg adapter reads error.column (set by PostgreSQL's 23502 error) and
      // populates meta.target from it. This test guards that mapping.
      const result = (prisma.article as any).create({ data: {} })

      await expect(result).rejects.toMatchObject({
        name: 'PrismaClientKnownRequestError',
        code: 'P2011',
        meta: expect.objectContaining({
          target: expect.arrayContaining(['title']),
        }),
      })
    })
  },
  {
    optOut: {
      from: [
        Providers.MYSQL,
        Providers.MARIADB,
        Providers.SQLITE,
        Providers.SQLSERVER,
        Providers.MONGODB,
        Providers.COCKROACHDB,
      ],
      reason: 'Tests pg-specific NOT NULL error mapping via error.column',
    },
  },
)
