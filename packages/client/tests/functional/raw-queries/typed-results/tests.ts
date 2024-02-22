import { Providers } from '../../_utils/providers'
import testMatrix from './_matrix'
// @ts-ignore
import type { Prisma as PrismaNamespace, PrismaClient } from './node_modules/@prisma/client'

declare let prisma: PrismaClient
declare let Prisma: typeof PrismaNamespace

testMatrix.setupTestSuite(
  ({ clientRuntime, driverAdapter, provider }) => {
    beforeEach(async () => {
      await prisma.testModel.deleteMany()
    })

    function getAllEntries() {
      if (provider === Providers.MYSQL) {
        return prisma.$queryRaw`SELECT * FROM \`TestModel\`;`
      } else {
        return prisma.$queryRaw`SELECT * FROM "TestModel";`
      }
    }

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

      const result = await getAllEntries()

      expect(result).toEqual([
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
          bool: driverAdapter === 'js_d1' || provider === 'mysql' ? 1 : true,
          dt: new Date('1900-10-10T01:10:10.001Z'),
          dec: driverAdapter === 'js_d1' ? 0.0625 : new Prisma.Decimal('0.0625'),
        },
      ])

      if (driverAdapter === 'js_d1') {
        // It's a number
        expect(result![0].bInt === 12345).toBe(true)
      } else {
        // It's a bigint
        expect(result![0].bInt === BigInt('12345')).toBe(true)
      }
    })

    test('query model with a BigInt = 2147483647 (i32)', async () => {
      await prisma.testModel.create({
        data: {
          bInt: BigInt(2147483647),
        },
      })

      const result = await getAllEntries()

      if (driverAdapter === 'js_d1') {
        // It's a number
        expect(result![0].bInt === BigInt('2147483647')).toBe(false)
        expect(result![0].bInt === 2147483647).toBe(true)
      } else {
        // It's a bigint
        expect(result![0].bInt === BigInt('2147483647')).toBe(true)
      }
    })

    test('query model with a BigInt = -2147483647 (-i32)', async () => {
      await prisma.testModel.create({
        data: {
          bInt: BigInt(-2147483647),
        },
      })

      const result = await getAllEntries()

      if (driverAdapter === 'js_d1') {
        // It's a number
        expect(result![0].bInt === -2147483647).toBe(true)
      } else {
        // It's a bigint
        expect(result![0].bInt === BigInt('-2147483647')).toBe(true)
      }
    })

    test('query model with a BigInt = MAX_SAFE_INTEGER', async () => {
      await prisma.testModel.create({
        data: {
          bInt: BigInt('9007199254740991'),
        },
      })

      const result = await getAllEntries()

      if (driverAdapter === 'js_d1' && clientRuntime !== 'wasm') {
        expect(result![0].bInt === 9007199254740991).toBe(true)
      } else {
        expect(result![0].bInt === BigInt('9007199254740991')).toBe(true)
      }
    })

    test('query model with a BigInt = -MAX_SAFE_INTEGER', async () => {
      await prisma.testModel.create({
        data: {
          bInt: BigInt('-9007199254740991'),
        },
      })

      const result = await getAllEntries()

      if (driverAdapter === 'js_d1' && clientRuntime !== 'wasm') {
        // It's a number
        expect(result![0].bInt === BigInt('-9007199254740991')).toBe(false)
        expect(result![0].bInt === -9007199254740991).toBe(true)
      } else {
        // It's a bigint
        expect(result![0].bInt === BigInt('-9007199254740991')).toBe(true)
      }
    })

    // https://developers.cloudflare.com/d1/build-databases/query-databases/
    // D1 supports 64-bit signed INTEGER values internally, however BigInts
    // are not currently supported in the API yet. JavaScript integers are safe up to Number.MAX_SAFE_INTEGER
    test('query model with a BigInt = MAX_SAFE_INTEGER + MAX_SAFE_INTEGER', async () => {
      await prisma.testModel.create({
        data: {
          bInt: BigInt('9007199254740991') + BigInt('9007199254740991'),
        },
      })

      const result = await getAllEntries()

      if (driverAdapter === 'js_d1') {
        // It's a number
        expect(result![0].bInt === 18014398509481982).toBe(true)
      } else {
        // It's a bigint
        expect(result![0].bInt === BigInt('9007199254740991') + BigInt('9007199254740991')).toBe(true)
        expect(result![0].bInt === 18014398509481982n).toBe(true)
      }
    })
    test('query model with a BigInt = -(MAX_SAFE_INTEGER + MAX_SAFE_INTEGER)', async () => {
      const create = prisma.testModel.create({
        data: {
          bInt: BigInt('-9007199254740991') + BigInt('-9007199254740991'),
        },
      })

      if (clientRuntime !== 'wasm') {
        if (driverAdapter === 'js_libsql') {
          await expect(create).rejects.toThrow(
            `bigint is too large to be represented as a 64-bit integer and passed as argument`,
          )
        } else if (driverAdapter === 'js_neon' || driverAdapter === 'js_pg') {
          // PostgresError { code: \"22003\", message: \"value \\\"-18428729675200069634\\\" is out of range for type bigint\", severity: \"ERROR\", detail: None, column: None, hint: None }
          await expect(create).rejects.toThrow(`is out of range for type bigint`)
        } else if (driverAdapter === 'js_planetscale') {
          await expect(create).rejects.toThrow(
            `Value out of range for the type. rpc error: code = FailedPrecondition desc = Out of range value for column 'bInt' at row 1`,
          )
        }
      } else {
        await create
        const result = await getAllEntries()

        if (driverAdapter === 'js_d1') {
          // It's a number
          expect(result![0].bInt === -18014398509481982).toBe(true)
        } else {
          // It's a bigint
          expect(result![0].bInt === BigInt('-9007199254740991') + BigInt('-9007199254740991')).toBe(true)
          expect(result![0].bInt === -18014398509481982n).toBe(true)
        }
      }
    })
  },
  {
    optOut: {
      from: ['mongodb'],
      reason: `
        $queryRaw only works on SQL based providers
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
