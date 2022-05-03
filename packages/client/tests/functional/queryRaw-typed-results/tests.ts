import { setupTestSuiteMatrix } from '../_utils/setupTestSuiteMatrix'

// @ts-ignore
declare let prisma: import('@prisma/client').PrismaClient
// @ts-ignore
declare let Prisma: typeof import('@prisma/client').Prisma

setupTestSuiteMatrix((suiteConfig) => {
  test('simple expression', async () => {
    const result = await prisma.$queryRaw`SELECT 1 + 1`
    expect(result).toEqual(2)
  })

  test('query model with multiple types', async () => {
    await prisma.testModel.create({
      data: {
        id: 1,
        string: 'str',
        int: 42,
        bInt: BigInt('9223372036854775807'),
        float: 1.5432,
        bytes: Buffer.from([1, 2, 3]),
        bool: true,
        dt: new Date('1900-10-10T01:10:10.001Z'),
        dec: new Prisma.Decimal('123.45678910'),
      },
    })

    const testModel = await prisma.$queryRaw`SELECT * FROM "TestModel"`

    const backwardCompatible = !suiteConfig['previewFeatures'].includes('improvedQueryRaw')
    const sqlite = suiteConfig['provider'] === 'sqlite'

    if (backwardCompatible || sqlite) {
      expect(testModel).toEqual({
        id: 1,
        string: 'str',
        int: 42,
        bInt: '9223372036854775807',
        float: 1.5432,
        bytes: 'AQID',
        bool: true,
        dt: '1900-10-10T01:10:10.001Z',
        dec: '123.45678910',
      })
    } else {
      expect(testModel).toEqual({
        id: 1,
        string: 'str',
        int: 42,
        bInt: BigInt('9223372036854775807'),
        float: 1.5432,
        bytes: Buffer.from([1, 2, 3]),
        bool: true,
        dt: new Date('1900-10-10T01:10:10.001Z'),
        dec: new Prisma.Decimal('123.45678910'),
      })
    }
  })
})
