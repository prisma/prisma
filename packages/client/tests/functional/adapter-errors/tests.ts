import { ok } from '@prisma/driver-adapter-utils'

import { NewPrismaClient } from '../_utils/types'
import testMatrix from './_matrix'
// @ts-ignore
import type { PrismaClient } from './node_modules/@prisma/client'

declare let newPrismaClient: NewPrismaClient<typeof PrismaClient>

testMatrix.setupTestSuite(
  () => {
    let prisma: PrismaClient

    const queryRawError = new Error('Error in queryRaw')
    const executeRawError = new Error('Error in executeRaw')
    const transactionError = new Error('Error in startTransaction')
    beforeAll(() => {
      prisma = newPrismaClient({
        adapter: {
          flavour: 'sqlite',
          queryRaw() {
            throw queryRawError
          },
          executeRaw() {
            throw executeRawError
          },
          startTransaction() {
            throw transactionError
          },
          close() {
            // method is not used at the moment
            return Promise.resolve(ok(undefined))
          },
        },
      })
    })
    test('correctly forwards error for queryRaw', async () => {
      const result = prisma.user.findFirst({})
      await expect(result).rejects.toBe(queryRawError)
    })

    test('correctly forwards error for executeRaw', async () => {
      const result = prisma.$executeRaw`SELECT 1`
      await expect(result).rejects.toBe(executeRawError)
    })

    test('correctly forwards error for implicit transactions', async () => {
      const result = prisma.user.create({
        data: {
          profile: {
            create: {},
          },
        },
      })
      await expect(result).rejects.toBe(transactionError)
    })

    test('correctly forwards error for batch transactions', async () => {
      const result = prisma.$transaction([prisma.user.create({}), prisma.user.create({})])
      await expect(result).rejects.toBe(transactionError)
    })

    test('correctly forwards error for itx', async () => {
      const result = prisma.$transaction(() => Promise.resolve())
      await expect(result).rejects.toBe(transactionError)
    })
  },
  {
    skipDefaultClientInstance: true,
    skipDb: true,
    skipBinary: {
      reason: 'Test requires driver adapters that are not available on binary engine',
    },
    skipProviderFlavor: {
      from: ['js_libsql'],
      reason: 'Test uses mock driver adapter',
    },
    skipDataProxy: {
      runtimes: ['edge', 'node'],
      reason: 'Test requires driver adapters that are not available on Data Proxy',
    },
    optOut: {
      from: ['postgresql', 'mysql', 'mongodb', 'cockroachdb', 'sqlserver'],
      reason: 'Test uses mock adapter and does not touch an actual database',
    },
  },
)
