import testMatrix from './_matrix'
// @ts-ignore
import type { PrismaClient } from './node_modules/@prisma/client'

declare let prisma: PrismaClient

// https://github.com/prisma/prisma/issues/13089
testMatrix.setupTestSuite(
  () => {
    beforeAll(async () => {
      await prisma.users.create({
        data: {
          firstName: 'foo',
        },
      })

      await prisma.users.create({
        data: {
          firstName: '$foo',
        },
      })
    })

    test('should return records when using a `$` in the search string', async () => {
      const records = await prisma.users.findMany({
        where: {
          firstName: '$foo',
        },
      })

      expect(records).toHaveLength(1)
      expect(records[0].firstName).toEqual('$foo')
    })

    test('should update records when using a `$` in the search string', async () => {
      const records = await prisma.users.update({
        where: {
          firstName: '$foo',
        },
        data: {
          firstName: '$$foo',
        },
        select: {
          firstName: true,
        },
      })

      expect(records).toHaveLength(1)
      expect(records[0].firstName).toEqual('$$foo')
    })

    test('should delete records when using a `$` in the search string', async () => {
      await prisma.users.delete({
        where: {
          firstName: '$$foo',
        },
      })
    })
  },
  {
    optOut: {
      from: ['cockroachdb', 'mysql', 'postgresql', 'sqlite', 'sqlserver'],
      reason: 'Only applicable to Mongodb',
    },
  },
)
