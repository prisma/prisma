import testMatrix from './_matrix'
// @ts-ignore
import { PrismaClient } from './node_modules/@prisma/client'

// https://github.com/prisma/prisma/issues/17061
testMatrix.setupTestSuite(
  () => {
    test('should not throw a type error when constructing default prisma client', () => {
      expect(() => {
        const _client = new PrismaClient().$extends(() => {})
      }).toThrow('@prisma/client did not initialize yet.')
    })
  },
  {
    // This test is asserting that the default JS and TS works correctly
    useDefaultClient: true,
  },
)
