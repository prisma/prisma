import testMatrix from './_matrix'

// @ts-ignore
declare let prisma: import('@prisma/client').PrismaClient
// @ts-ignore
declare let Prisma: typeof import('@prisma/client').Prisma

testMatrix.setupTestSuite(
  (suiteConfig) => {
    test('simple expression', async () => {
      const result = (await prisma.$queryRaw`SELECT 1 + 1`) as Array<Record<string, unknown>>
      expect(Object.values(result[0])[0]).toEqual(2)
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

      const backwardCompatible = !suiteConfig['previewFeatures'].includes('improvedQueryRaw')
      const sqlite = suiteConfig['provider'] === 'sqlite'

      if (backwardCompatible || sqlite) {
        expect(testModel).toEqual([
          {
            id: 1,
            string: 'str',
            int: 42,
            bInt: 12345,
            float: 0.125,
            bytes: 'AQID',
            bool: true,
            dt: '1900-10-10T01:10:10.001+00:00',
            dec: 0.0625,
          },
        ])
      } else {
        expect(testModel).toEqual([
          {
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
        ])
      }
    })
  },
  { optIn: ['sqlite', 'postgresql'] },
)
