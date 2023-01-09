import { NewPrismaClient } from '../../_utils/types'
import testMatrix from './_matrix'
// @ts-ignore
import type { PrismaClient } from './node_modules/@prisma/client'

declare let newPrismaClient: NewPrismaClient<typeof PrismaClient>

// https://github.com/prisma/prisma/issues/17061
testMatrix.setupTestSuite(
  () => {
    test('should not throw a type error when constructing default prisma client', () => {
      expect(() => {
        const _client = newPrismaClient().$extends(() => {})
      }).toThrow('@prisma/client did not initialize yet.')
    })
  },
  {
    // This test is asserting that the default JS and TS works correctly
    useDefaultClient: true,
  },
)
