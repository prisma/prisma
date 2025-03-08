import { Providers } from '../_utils/providers'
import testMatrix from './_matrix'
// @ts-ignore
import type { Prisma as PrismaNamespace, PrismaClient } from './node_modules/@prisma/client'

declare let prisma: PrismaClient
declare let Prisma: typeof PrismaNamespace

// Note: Test inspired by ./raw-queries/typed-results/tests.ts

testMatrix.setupTestSuite(
  ({ driverAdapter, provider }) => {
    const isD1 = driverAdapter === 'js_d1'

    beforeEach(async () => {
      await prisma.testModel.deleteMany()
    })

    function getAllEntries() {
      if (provider === Providers.MYSQL) {
        return prisma.$queryRaw`SELECT * FROM \`TestModel\`;`
      }
      return prisma.$queryRaw`SELECT * FROM "TestModel";`
    }

    skipTestIf(isD1 || provider === Providers.MYSQL)('Bool field: true or false should succeed', async () => {
      await prisma.testModel.create({
        data: {
          bool: true,
        },
      })

      await prisma.testModel.create({
        data: {
          bool: false,
        },
      })

      const resultFromQueryRaw = await getAllEntries()
      const resultFromFindMany = await prisma.testModel.findMany()

      expect(resultFromQueryRaw).toStrictEqual([
        {
          id: expect.anything(),
          bInt: null,
          bool: true,
          bytes: null,
          dec: null,
          dt: null,
          float: null,
          int: null,
          string: null,
        },
        {
          id: expect.anything(),
          bInt: null,
          bool: false,
          bytes: null,
          dec: null,
          dt: null,
          float: null,
          int: null,
          string: null,
        },
      ])
      expect(resultFromQueryRaw).toStrictEqual(resultFromFindMany)
    })

    test('String field: true or false as string should succeed', async () => {
      await prisma.testModel.create({
        data: {
          string: 'true',
        },
      })

      await prisma.testModel.create({
        data: {
          string: 'false',
        },
      })

      const resultFromQueryRaw = await getAllEntries()
      const resultFromFindMany = await prisma.testModel.findMany()

      expect(resultFromQueryRaw).toStrictEqual([
        {
          id: expect.anything(),
          bInt: null,
          bool: null,
          bytes: null,
          dec: null,
          dt: null,
          float: null,
          int: null,
          string: 'true',
        },
        {
          id: expect.anything(),
          bInt: null,
          bool: null,
          bytes: null,
          dec: null,
          dt: null,
          float: null,
          int: null,
          string: 'false',
        },
      ])
      expect(resultFromQueryRaw).toStrictEqual(resultFromFindMany)
    })

    test('shows differences between queryRaw and findMany', async () => {
      await prisma.testModel.create({
        data: {
          string: 'str',
          int: 42,
          bInt: BigInt('12345'),
          float: 0.125,
          bytes: Uint8Array.from([1, 2, 3]),
          bool: true,
          dt: new Date('1900-10-10T01:10:10.001Z'),
          dec: new Prisma.Decimal('0.0625'),
        },
      })

      const resultFromQueryRaw = await getAllEntries()
      const resultFromFindMany = await prisma.testModel.findMany()

      expect(resultFromQueryRaw).toStrictEqual([
        {
          id: expect.anything(),
          string: 'str',
          int: 42,
          // TODO: replace with exact value and remove next assert after
          // https://github.com/facebook/jest/issues/11617 is fixed
          // see client/tests/functional/raw-queries/typed-results/tests.ts
          bInt: expect.anything(),
          float: 0.125,
          bytes: Uint8Array.from([1, 2, 3]),
          bool: isD1 || provider === Providers.MYSQL ? 1 : true,
          dt: new Date('1900-10-10T01:10:10.001Z'),
          dec: isD1 ? 0.0625 : new Prisma.Decimal('0.0625'),
        },
      ])
      expect(resultFromFindMany).toStrictEqual([
        {
          id: expect.anything(),
          string: 'str',
          int: 42,
          // TODO: replace with exact value and remove next assert after
          // https://github.com/facebook/jest/issues/11617 is fixed
          // see client/tests/functional/raw-queries/typed-results/tests.ts
          bInt: expect.anything(),
          float: 0.125,
          bytes: Uint8Array.from([1, 2, 3]),
          // -> Diff, value is a Boolean, which is correct.
          bool: true,
          dt: new Date('1900-10-10T01:10:10.001Z'),
          // -> Diff, value is a Decimal, which is correct.
          dec: new Prisma.Decimal('0.0625'),
        },
      ])

      if (isD1 || provider === Providers.MYSQL) {
        expect(resultFromQueryRaw).not.toEqual(resultFromFindMany)
      } else {
        expect(resultFromQueryRaw).toStrictEqual(resultFromFindMany)
      }
    })

    test('a record with all fields set to null should succeed', async () => {
      await prisma.testModel.create({
        data: {}, // Note that this line is required
      })

      const resultFromQueryRaw = await getAllEntries()
      const resultFromFindMany = await prisma.testModel.findMany()

      expect(resultFromQueryRaw).toStrictEqual([
        {
          id: expect.anything(),
          bInt: null,
          bool: null,
          bytes: null,
          dec: null,
          dt: null,
          float: null,
          int: null,
          string: null,
        },
      ])
      expect(resultFromQueryRaw).toStrictEqual(resultFromFindMany)
    })

    test('2 records, 1st with null, 2nd with values should succeed', async () => {
      await prisma.testModel.create({
        data: {}, // Note that this line is required
      })

      await prisma.testModel.create({
        data: {
          string: 'str',
          int: 42,
          bInt: BigInt('12345'),
          float: 0.125,
          bytes: Uint8Array.from([1, 2, 3]),
          bool: true,
          dt: new Date('1900-10-10T01:10:10.001Z'),
          dec: new Prisma.Decimal('0.0625'),
        },
      })

      const resultFromQueryRaw = await getAllEntries()
      const resultFromFindMany = await prisma.testModel.findMany()

      expect(resultFromQueryRaw).toStrictEqual([
        {
          id: expect.anything(),
          bInt: null,
          bool: null,
          bytes: null,
          dec: null,
          dt: null,
          float: null,
          int: null,
          string: null,
        },
        {
          id: expect.anything(),
          string: 'str',
          int: 42,
          // TODO: replace with exact value and remove next assert after
          // https://github.com/facebook/jest/issues/11617 is fixed
          // see client/tests/functional/raw-queries/typed-results/tests.ts
          bInt: expect.anything(),
          float: 0.125,
          bytes: Uint8Array.from([1, 2, 3]),
          bool: isD1 || provider === Providers.MYSQL ? 1 : true,
          dt: new Date('1900-10-10T01:10:10.001Z'),
          dec: isD1 ? 0.0625 : new Prisma.Decimal('0.0625'),
        },
      ])
      // TODO?
      if (isD1 || provider === Providers.MYSQL) {
        expect(resultFromQueryRaw).not.toEqual(resultFromFindMany)
      } else {
        expect(resultFromQueryRaw).toStrictEqual(resultFromFindMany)
      }
    })

    test('all fields are null', async () => {
      await prisma.testModel.create({
        data: {},
      })

      const resultFromQueryRaw = await getAllEntries()
      const resultFromFindMany = await prisma.testModel.findMany()

      expect(resultFromQueryRaw).toStrictEqual([
        {
          id: expect.anything(),
          bInt: null,
          bool: null,
          bytes: null,
          dec: null,
          dt: null,
          float: null,
          int: null,
          string: null,
        },
      ])
      expect(resultFromQueryRaw).toStrictEqual(resultFromFindMany)
    })
  },
  {
    optOut: {
      from: ['mongodb'],
      reason: `
        $queryRaw only works on SQL based providers
      `,
    },
  },
)
