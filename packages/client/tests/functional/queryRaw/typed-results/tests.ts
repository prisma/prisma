import testMatrix from './_matrix'

// @ts-ignore
declare let prisma: import('@prisma/client').PrismaClient
// @ts-ignore
declare let Prisma: typeof import('@prisma/client').Prisma

testMatrix.setupTestSuite(
  () => {
    test('simple expression', async () => {
      const result = (await prisma.$queryRaw`SELECT 1 + 1`) as Array<Record<string, unknown>>
      expect(Number(Object.values(result[0])[0])).toEqual(2)
    })

    test('query model with multiple types', async () => {
      await prisma.testModel.create({
        data: {
          id: 1,
          string: 'str',
          int: 42,
          bInt: BigInt('12345'),
          float: 0.125,
          bytes: Buffer.from([1, 2, 3]),
          bool: true,
          dt: new Date('1900-10-10T01:10:10.001Z'),
          dec: new Prisma.Decimal('0.0625'),
        },
      })

      const testModel = await prisma.$queryRaw`SELECT * FROM "TestModel"`

      expect(testModel).toEqual([
        {
          id: 1,
          string: 'str',
          int: 42,
          // TODO: replace with exact value and remove next assert after
          // https://github.com/facebook/jest/issues/11617 is fixed
          bInt: expect.any(BigInt),
          float: 0.125,
          bytes: Buffer.from([1, 2, 3]),
          bool: true,
          dt: new Date('1900-10-10T01:10:10.001Z'),
          dec: new Prisma.Decimal('0.0625'),
        },
      ])
      // @ts-ignore
      expect(testModel[0].bInt === BigInt('12345')).toBe(true)
    })
  },
  {
    optOut: {
      from: ['mongodb', 'mysql'],
      reason: `
        $queryRaw only works on SQL based providers
        mySql You have an error in your SQL syntax; check the manual that corresponds to your MariaDB server version for the right syntax to use near '"TestModel"'
      `,
    },
  },
)
