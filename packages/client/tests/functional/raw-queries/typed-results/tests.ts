import testMatrix from './_matrix'
// @ts-ignore
import type { Prisma as PrismaNamespace, PrismaClient } from './node_modules/@prisma/client'

declare let prisma: PrismaClient
declare let Prisma: typeof PrismaNamespace

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
          bInt: expect.anything(),
          float: 0.125,
          bytes: Buffer.from([1, 2, 3]),
          bool: true,
          dt: new Date('1900-10-10T01:10:10.001Z'),
          dec: new Prisma.Decimal('0.0625'),
        },
      ])
      expect(testModel![0].bInt === BigInt('12345')).toBe(true)
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
