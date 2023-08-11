import testMatrix from './_matrix'
// @ts-ignore
import type { PrismaClient } from './node_modules/@prisma/client'

declare let prisma: PrismaClient

/**
 * Regression test for https://github.com/prisma/prisma/issues/13405 and
 * https://github.com/prisma/prisma/issues/14543
 */
testMatrix.setupTestSuite(
  () => {
    describe('mongo raw queries should work inside iTX', () => {
      test('findRaw', async () => {
        const result = await prisma.$transaction(async (prisma) => {
          await prisma.testModel.create({
            data: {
              id: 10,
              field: 'A',
            },
          })

          return await prisma.testModel.findRaw({
            filter: {
              _id: 10,
            },
          })
        })

        expect(result).toEqual([
          {
            _id: 10,
            field: 'A',
          },
        ])
      })

      test('aggregateRaw', async () => {
        const result = await prisma.$transaction(async (prisma) => {
          await prisma.testModel.create({
            data: {
              id: 20,
              field: 'A',
            },
          })

          return await prisma.testModel.aggregateRaw({
            pipeline: [
              {
                $match: {
                  _id: 20,
                },
              },
            ],
          })
        })

        expect(result).toEqual([
          {
            _id: 20,
            field: 'A',
          },
        ])
      })

      test('runCommandRaw', async () => {
        const result = await prisma.$transaction(async (prisma) => {
          return await prisma.$runCommandRaw({
            insert: 'TestModel',
            documents: [
              { _id: 30, field: 'A' },
              { _id: 31, field: 'B' },
              { _id: 32, field: 'C' },
            ],
          })
        })

        expect(result).toEqual({ n: 3, ok: 1 })
      })
    })

    describe('iTX functionality should work when using mongo raw queries', () => {
      test('commit', async () => {
        await prisma.$transaction(async (prisma) => {
          await prisma.$runCommandRaw({
            insert: 'TestModel',
            documents: [{ _id: 40, field: 'A' }],
          })
        })

        const result = await prisma.testModel.findRaw({
          filter: { _id: 40 },
        })

        expect(result).toEqual([{ _id: 40, field: 'A' }])
      })

      test('rollback', async () => {
        const tx = prisma.$transaction(async (prisma) => {
          await prisma.$runCommandRaw({
            insert: 'TestModel',
            documents: [{ _id: 50, field: 'A' }],
          })

          expect(
            await prisma.testModel.findRaw({
              filter: { _id: 50 },
            }),
          ).toEqual([{ _id: 50, field: 'A' }])

          throw new Error('changed my mind, sorry')
        })

        await expect(tx).rejects.toThrow(/changed my mind/)

        expect(
          await prisma.testModel.findRaw({
            filter: { _id: 50 },
          }),
        ).toEqual([])
      })
    })
  },
  {
    optOut: {
      from: ['sqlite', 'mysql', 'postgresql', 'sqlserver', 'cockroachdb'],
      reason: 'findRaw, runCommandRaw and aggregateRaw are MongoDB-only APIs',
    },
  },
)
