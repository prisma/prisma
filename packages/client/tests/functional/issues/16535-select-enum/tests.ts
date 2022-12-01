import testMatrix from './_matrix'
// @ts-ignore
import type { Prisma as PrismaNamespace, PrismaClient } from './node_modules/@prisma/client'

declare let prisma: PrismaClient
declare let Prisma: typeof PrismaNamespace

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
