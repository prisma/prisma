import testMatrix from './_matrix'
// @ts-ignore
import type { PrismaClient } from './generated/prisma/client'

declare let prisma: PrismaClient

testMatrix.setupTestSuite(
  () => {
    describe('bytes field', () => {
      test('all bytes', async () => {
        const bytes = Uint8Array.from([1, 2, 3, 4, 5, 6, 7, 8])

        const result = await prisma.testModel.create({
          data: {
            uint64: bytes,
          },
        })

        expect(result.uint64).toEqual(bytes)
      })

      test('empty byte array', async () => {
        const result = await prisma.testModel.create({
          data: {
            uint64: Uint8Array.from([]),
          },
        })

        expect(result.uint64).toEqual(Uint8Array.from([0, 0, 0, 0, 0, 0, 0, 0]))
      })

      test('too many bytes', async () => {
        await expect(
          async () =>
            await prisma.testModel.create({
              data: {
                uint64: Uint8Array.from([1, 2, 3, 4, 5, 6, 7, 8, 9]),
              },
            }),
        ).rejects.toThrow(
          /Out of range value for column 'uint64'|The provided value for the column is too long for the column's type. Column: uint64/,
        )
      })
    })

    test('boolean fields', async () => {
      const result = await prisma.testModel.create({
        data: {
          bool1: true,
          bool2: false,
        },
      })

      expect(result).toMatchObject({
        bool1: true,
        bool2: false,
      })
    })

    test('raw query', async () => {
      const result = (await prisma.$queryRaw`SELECT b'1' AS bit`) as Array<{ bit: Uint8Array }>
      expect(result[0].bit).toEqual(Uint8Array.from([1]))
    })
  },
  {
    optOut: {
      from: ['cockroachdb', 'mongodb', 'postgresql', 'sqlite', 'sqlserver'],
      reason: `
        Testing a MySQL specific data type
      `,
    },
  },
)
