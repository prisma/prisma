import { NewPrismaClient } from '../../_utils/types'
import { mockAdapterErrors, mockAdapterFactory } from '../_utils/mock-adapter'
import { defaultTestSuiteOptions } from '../_utils/test-suite-options'
import testMatrix from './_matrix'
// @ts-ignore
import type { PrismaClient } from './generated/prisma/client'

declare const newPrismaClient: NewPrismaClient<PrismaClient, typeof PrismaClient>

testMatrix.setupTestSuite(
  ({ provider }) => {
    let prisma: PrismaClient

    beforeAll(() => {
      prisma = newPrismaClient({
        adapter: mockAdapterFactory(provider),
      })
    })
    test('correctly forwards error for queryRaw', async () => {
      const result = prisma.user.findFirst({})
      await expect(result).rejects.toBe(mockAdapterErrors.queryRaw)
    })

    test('correctly forwards error for executeRaw', async () => {
      const result = prisma.$executeRaw`SELECT 1`
      await expect(result).rejects.toBe(mockAdapterErrors.executeRaw)
    })

    test('correctly forwards error for implicit transactions', async () => {
      const result = prisma.user.create({
        data: {
          profile: {
            create: {},
          },
        },
      })
      await expect(result).rejects.toBe(mockAdapterErrors.startTransaction)
    })

    test('correctly forwards error for batch transactions', async () => {
      const result = prisma.$transaction([prisma.user.create({}), prisma.user.create({})])
      await expect(result).rejects.toBe(mockAdapterErrors.startTransaction)
    })

    test('correctly forwards error for itx', async () => {
      const result = prisma.$transaction(() => Promise.resolve())
      await expect(result).rejects.toBe(mockAdapterErrors.startTransaction)
    })
  },
  {
    ...defaultTestSuiteOptions,
    skipDb: true,
  },
)
