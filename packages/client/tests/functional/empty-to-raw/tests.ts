import testMatrix from './_matrix'

// @ts-ignore this is just for type checks
declare let prisma: import('@prisma/client').PrismaClient
// @ts-ignore this is just for type checks
declare let Prisma: import('@prisma/client').Prisma

testMatrix.setupTestSuite(
  ({ provider }) => {
    test('should not throw when using Prisma.empty inside $executeRaw', async () => {
      expect.assertions(1)

      let result: any

      try {
        result = await prisma.$executeRaw(Prisma.empty)
      } catch (error) {
        result = error
      }

      switch (provider) {
        case 'sqlite':
          expect((result as Error).message).toContain('Raw query failed. Code: `21`. Message: `not an error`')
          break

        case 'postgresql':
          expect(result).toEqual(0)
          break

        case 'cockroachdb':
          expect(result).toEqual(0)
          break

        case 'sqlserver':
          expect(result).toEqual(0)
          break

        case 'mysql':
          expect((result as Error).message).toContain('Raw query failed. Code: `1065`. Message: `Query was empty`')
          break

        default:
          throw new Error('invalid prodiver')
      }
    })

    test('should not throw when using Prisma.empty inside $queryRaw', async () => {
      expect.assertions(1)

      let result: any

      try {
        result = await prisma.$queryRaw(Prisma.empty)
      } catch (error) {
        result = error
      }

      switch (provider) {
        case 'sqlite':
          expect((result as Error).message).toContain('Raw query failed. Code: `21`. Message: `not an error`')
          break

        case 'postgresql':
          expect(result).toEqual([])
          break

        case 'cockroachdb':
          expect(result).toEqual([])
          break

        case 'sqlserver':
          expect(result).toEqual([])
          break

        case 'mysql':
          expect((result as Error).message).toContain('Raw query failed. Code: `1065`. Message: `Query was empty`')
          break

        default:
          throw new Error('invalid prodiver')
      }
    })
  },
  {
    optOut: {
      from: ['mongodb'],
      reason: '$raw methods not allowed when using mongodb',
    },
  },
)
