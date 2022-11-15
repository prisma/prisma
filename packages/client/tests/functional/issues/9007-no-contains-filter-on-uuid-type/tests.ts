// @ts-ignore
import type { Prisma, PrismaClient } from '@prisma/client'
import { expectTypeOf } from 'expect-type'

import testMatrix from './_matrix'

declare let prisma: PrismaClient

// https://github.com/prisma/prisma/issues/9007
testMatrix.setupTestSuite(
  () => {
    test('should throw an error if using contains filter on uuid type', async () => {
      await prisma.user.create({ data: {} })

      await expect(() =>
        prisma.user.findMany({
          where: {
            // @ts-expect-error
            uuid: { contains: 'foo-bar' },
          },
        }),
      ).rejects.toThrowError()
    })

    test('should not generate the contains field on the where type', () => {
      expectTypeOf<Prisma.UuidFilter>().not.toHaveProperty('contains')
    })
  },
  {
    optOut: {
      from: ['mongodb', 'sqlserver', 'mysql', 'sqlite'],
      reason: '@db.Uuid not supported here',
    },
  },
)
