import testMatrix from './_matrix'

// @ts-ignore this is just for type checks
declare let prisma: import('@prisma/client').PrismaClient

testMatrix.setupTestSuite(
  () => {
    beforeAll(async () => {
      await prisma.user.create({
        data: {
          age: 1,
          name: null,
        },
      })

      await prisma.user.create({
        data: {
          age: 2,
          name: 'a',
        },
      })

      await prisma.user.create({
        data: {
          age: 3,
          name: null,
        },
      })

      await prisma.user.create({
        data: {
          age: 4,
          name: 'b',
        },
      })
    })

    test('should return records sorted by name asc and null first', async () => {
      const records = await prisma.user.findMany({
        select: {
          name: true,
        },
        orderBy: {
          name: {
            sort: 'asc',
            nulls: 'first',
          },
        },
      })

      expect(records).toMatchObject([
        {
          name: null,
        },
        {
          name: null,
        },
        {
          name: 'a',
        },
        {
          name: 'b',
        },
      ])
    })

    test('should return records sorted by name asc and null last', async () => {
      const records = await prisma.user.findMany({
        select: {
          name: true,
        },
        orderBy: {
          name: {
            sort: 'asc',
            nulls: 'last',
          },
        },
      })

      expect(records).toMatchObject([
        {
          name: 'a',
        },
        {
          name: 'b',
        },
        {
          name: null,
        },
        {
          name: null,
        },
      ])
    })

    test('should return records sorted by name desc and null first', async () => {
      const records = await prisma.user.findMany({
        select: {
          name: true,
        },
        orderBy: {
          name: {
            sort: 'desc',
            nulls: 'first',
          },
        },
      })

      expect(records).toMatchObject([
        {
          name: null,
        },
        {
          name: null,
        },
        {
          name: 'b',
        },
        {
          name: 'a',
        },
      ])
    })

    test('should return records sorted by name desc and null last', async () => {
      const records = await prisma.user.findMany({
        select: {
          name: true,
        },
        orderBy: {
          name: {
            sort: 'desc',
            nulls: 'last',
          },
        },
      })

      expect(records).toMatchObject([
        {
          name: 'b',
        },
        {
          name: 'a',
        },
        {
          name: null,
        },
        {
          name: null,
        },
      ])
    })
  },
  {
    optOut: {
      from: ['mongodb'],
      reason: 'Orderby Null not supported on mongodb',
    },
  },
)
