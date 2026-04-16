import { defaultTestSuiteOptions } from '../_utils/test-suite-options'
import testMatrix from './_matrix'
// @ts-ignore
import type { PrismaClient } from './generated/prisma/client'

declare let prisma: PrismaClient

testMatrix.setupTestSuite(
  () => {
    test('P2002: meta.target is populated via driver-adapter path', async () => {
      await prisma.role.create({ data: { shortCode: 'ADMIN' } })

      // Duplicate insert should trigger a unique constraint violation.
      const result = prisma.role.create({ data: { shortCode: 'ADMIN' } })

      await expect(result).rejects.toMatchObject({
        name: 'PrismaClientKnownRequestError',
        code: 'P2002',
        meta: {
          // Adapters that resolve field names (e.g. js_pg) return the actual
          // field name(s); adapters that only expose the index name
          // (e.g. js_mariadb) return the index name. Either way target must
          // be a non-empty array.
          target: expect.arrayContaining([expect.any(String)]),
        },
      })
    })

    test('P2002: meta.driverAdapterError is still present alongside meta.target', async () => {
      await prisma.role.create({ data: { shortCode: 'EDITOR' } })

      const result = prisma.role.create({ data: { shortCode: 'EDITOR' } })

      await expect(result).rejects.toMatchObject({
        name: 'PrismaClientKnownRequestError',
        code: 'P2002',
        meta: expect.objectContaining({
          driverAdapterError: expect.anything(),
          target: expect.arrayContaining([expect.any(String)]),
        }),
      })
    })
  },
  {
    ...defaultTestSuiteOptions,
  },
)
