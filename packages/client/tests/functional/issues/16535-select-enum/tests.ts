import testMatrix from './_matrix'
// @ts-ignore
import type { PrismaClient } from './node_modules/@prisma/client'

declare let prisma: PrismaClient

testMatrix.setupTestSuite(
  () => {
    test('allows to select enum field', async () => {
      const user = await prisma.user.create({
        data: {
          role: 'ADMIN',
        },
        select: {
          role: true,
        },
      })

      expect(user).toEqual({ role: 'ADMIN' })
    })
  },
  {
    optOut: {
      from: ['sqlite', 'mongodb', 'sqlserver'],
      reason: 'No support for enums',
    },
  },
)
