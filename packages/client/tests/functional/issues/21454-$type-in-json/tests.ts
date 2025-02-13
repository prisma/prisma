// @ts-ignore
import testMatrix from './_matrix'
import type { PrismaClient } from './node_modules/@prisma/client'

declare let prisma: PrismaClient

testMatrix.setupTestSuite(
  () => {
    test('preserves json with $type key inside', async () => {
      const { json } = await prisma.test.create({ data: { json: { $type: 'Thing' } } })

      expect(json).toEqual({ $type: 'Thing' })
    })

    test('preserves deeply nested json with $type key inside', async () => {
      const { json } = await prisma.test.create({ data: { json: { nested: { $type: 'Thing' } } } })

      expect(json).toEqual({ nested: { $type: 'Thing' } })
    })
  },
  {
    optOut: {
      from: ['sqlserver'],
      reason: 'JSON column is not supported',
    },
  },
)
