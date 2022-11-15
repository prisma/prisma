// @ts-ignore
import type { PrismaClient } from '@prisma/client'

import testMatrix from './_matrix'

declare let prisma: PrismaClient

// https://github.com/prisma/prisma/issues/15177
testMatrix.setupTestSuite(
  () => {
    test('should allow CRUD methods on a table column that has a space', async () => {
      const created = await prisma.customer.create({
        data: {
          test: true,
        },
      })

      const read = await prisma.customer.findMany({
        where: {
          userId: created.userId,
        },
      })

      expect(read).toBeDefined()

      const updated = await prisma.customer.update({
        where: {
          userId: created.userId,
        },
        data: {
          test: false,
        },
      })

      expect(updated.test).toEqual(false)

      const deleted = await prisma.customer.delete({
        where: {
          userId: created.userId,
        },
      })

      expect(deleted).toBeDefined()
    })
  },
  {
    optOut: {
      from: ['mongodb'],
      reason: 'Mongodb dont have tables or columns',
    },
  },
)
