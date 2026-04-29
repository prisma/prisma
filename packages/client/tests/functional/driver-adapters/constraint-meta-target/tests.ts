import { Providers } from '../../_utils/providers'
import { defaultTestSuiteOptions } from '../_utils/test-suite-options'
import testMatrix from './_matrix'
// @ts-ignore
import type { PrismaClient } from './generated/prisma/client'

declare let prisma: PrismaClient

testMatrix.setupTestSuite(
  () => {
    test('P2002: meta.target is populated and meta.driverAdapterError is preserved', async () => {
      await prisma.role.create({ data: { shortCode: 'ADMIN', name: 'Administrator' } })

      // Duplicate insert triggers a unique constraint violation (P2002).
      const result = prisma.role.create({ data: { shortCode: 'ADMIN', name: 'Duplicate' } })

      await expect(result).rejects.toMatchObject({
        name: 'PrismaClientKnownRequestError',
        code: 'P2002',
        meta: expect.objectContaining({
          // js_pg resolves field names; js_mariadb exposes the index name.
          // Either way target must be a non-empty string[].
          target: expect.arrayContaining([expect.any(String)]),
          // Preserved for backward compatibility.
          driverAdapterError: expect.anything(),
        }),
      })
    })

    test('P2011: meta.target is populated for null constraint violation', async () => {
      // Bypass TypeScript's required-field check to force a null into a NOT NULL column.
      const result = (prisma.role as any).create({ data: { shortCode: 'VIEWER' } })

      await expect(result).rejects.toMatchObject({
        name: 'PrismaClientKnownRequestError',
        code: 'P2011',
        meta: expect.objectContaining({
          target: expect.arrayContaining([expect.any(String)]),
        }),
      })
    })
  },
  {
    ...defaultTestSuiteOptions,
    skipDefaultClientInstance: false,
    optOut: {
      from: [Providers.COCKROACHDB, Providers.SQLSERVER, Providers.MONGODB, Providers.SQLITE],
      reason: 'SQLite does not surface constraint metadata via driver adapters',
    },
  },
)
