import testMatrix from './_matrix'
// @ts-ignore
import type { Prisma as PrismaNamespace, PrismaClient } from './node_modules/@prisma/client'

declare let prisma: PrismaClient
declare let Prisma: typeof PrismaNamespace

testMatrix.setupTestSuite(
  ({ clientRuntime, driverAdapter }) => {
    beforeEach(async () => {
      await prisma.testModel.deleteMany()
    })

    test('simple expression', async () => {
      const result = (await prisma.$queryRaw`SELECT 1 + 1`) as Array<Record<string, unknown>>
      expect(Number(Object.values(result[0])[0])).toEqual(2)
    })

    test('query model with multiple types', async () => {
      await prisma.testModel.create({
        data: {
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
          id: expect.anything(),
          string: 'str',
          int: 42,
          // TODO: replace with exact value and remove next assert after
          // https://github.com/facebook/jest/issues/11617 is fixed
          bInt: expect.anything(),
          float: 0.125,
          // TODO: The buffer binary data does not match the expected one
          // testModel![0].bytes.constructor shows different things, see below
          // wasm:
          // [Function: C] {
          //   TYPED_ARRAY_SUPPORT: true,
          //   poolSize: 8192,
          //   from: [Function (anonymous)],
          //   alloc: [Function (anonymous)],
          //   allocUnsafe: [Function (anonymous)],
          //   allocUnsafeSlow: [Function (anonymous)],
          //   isBuffer: [Function (anonymous)],
          //   compare: [Function (anonymous)],
          //   isEncoding: [Function (anonymous)],
          //   concat: [Function (anonymous)],
          //   byteLength: [Function: In]
          // }
          // library:
          // [Function: Buffer] {
          //   poolSize: 8192,
          //   from: [Function: from],
          //   copyBytesFrom: [Function: copyBytesFrom],
          //   of: [Function: of],
          //   alloc: [Function: alloc],
          //   allocUnsafe: [Function: allocUnsafe],
          //   allocUnsafeSlow: [Function: allocUnsafeSlow],
          //   isBuffer: [Function: isBuffer],
          //   compare: [Function: compare],
          //   isEncoding: [Function: isEncoding],
          //   concat: [Function: concat],
          //   byteLength: [Function: byteLength],
          //   [Symbol(kIsEncodingSymbol)]: [Function: isEncoding]
          // }
          bytes: clientRuntime === 'wasm' ? expect.anything() : Buffer.from([1, 2, 3]),
          bool: driverAdapter === 'js_d1' ? 1 : true,
          dt: new Date('1900-10-10T01:10:10.001Z'),
          dec: driverAdapter === 'js_d1' ? 0.0625 : new Prisma.Decimal('0.0625'),
        },
      ])
      if (driverAdapter === 'js_d1') {
        expect(testModel![0].bInt === BigInt('12345')).toBe(false)
        expect(testModel![0].bInt === 12345).toBe(true)
      } else {
        expect(testModel![0].bInt === BigInt('12345')).toBe(true)
      }
    })

    test('query model with a BigInt = 2147483647 (i32)', async () => {
      await prisma.testModel.create({
        data: {
          bInt: BigInt(2147483647),
        },
      })

      const result = await prisma.$queryRaw`SELECT * FROM "TestModel"`
      if (driverAdapter === 'js_d1') {
        expect(result![0].bInt === BigInt('2147483647')).toBe(false)
        expect(result![0].bInt === 2147483647).toBe(true)
      } else {
        expect(result![0].bInt === BigInt('2147483647')).toBe(true)
      }
    })

    test('query model with a BigInt = -2147483647 (-i32)', async () => {
      await prisma.testModel.create({
        data: {
          bInt: BigInt(-2147483647),
        },
      })

      const result = await prisma.$queryRaw`SELECT * FROM "TestModel"`
      if (driverAdapter === 'js_d1') {
        expect(result![0].bInt === BigInt('-2147483647')).toBe(false)
        expect(result![0].bInt === -2147483647).toBe(true)
      } else {
        expect(result![0].bInt === BigInt('-2147483647')).toBe(true)
      }
    })

    test('query model with a BigInt = MAX_SAFE_INTEGER', async () => {
      await prisma.testModel.create({
        data: {
          bInt: BigInt(Number.MAX_SAFE_INTEGER),
        },
      })

      const result = await prisma.$queryRaw`SELECT * FROM "TestModel"`
      expect(result![0].bInt === BigInt('9007199254740991')).toBe(true)
    })

    test('query model with a BigInt = -MAX_SAFE_INTEGER', async () => {
      await prisma.testModel.create({
        data: {
          bInt: BigInt(-Number.MAX_SAFE_INTEGER),
        },
      })

      const result = await prisma.$queryRaw`SELECT * FROM "TestModel"`
      expect(result![0].bInt === BigInt('-9007199254740991')).toBe(true)
    })

    // https://developers.cloudflare.com/d1/build-databases/query-databases/
    // D1 supports 64-bit signed INTEGER values internally, however BigInts
    // are not currently supported in the API yet. JavaScript integers are safe up to Number.MAX_SAFE_INTEGER
    test('query model with a BigInt = MAX_SAFE_INTEGER + 123456789', async () => {
      const create = prisma.testModel.create({
        data: {
          bInt: BigInt(Number.MAX_SAFE_INTEGER) + BigInt(123456789),
        },
      })

      if (driverAdapter === 'js_d1') {
        await expect(create).rejects.toThrow(`D1 supports 64-bit signed INTEGER values internally, however BigInts`)
      } else {
        await create
        const result = await prisma.$queryRaw`SELECT * FROM "TestModel"`
        expect(result![0].bInt === BigInt(Number.MAX_SAFE_INTEGER) + BigInt(123456789)).toBe(true)
        expect(result![0].bInt === 9007199378197780n).toBe(true)
      }
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
    skipDataProxy: {
      runtimes: ['edge'],
      reason: `
        This test is broken with the edge client. It needs to be updated to
        send ArrayBuffers and expect them as results, and the client might need
        to be fixed to return ArrayBuffers and not polyfilled Buffers in
        query results.
      `,
    },
  },
)
