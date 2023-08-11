import testMatrix from './_matrix'
// @ts-ignore
import type { PrismaClient } from './node_modules/@prisma/client'

declare let prisma: PrismaClient

const id = '000000000000000000000000'

testMatrix.setupTestSuite(
  ({ provider }) => {
    test('middleware with count', async () => {
      expect.assertions(1)
      prisma.$use((params, next) => {
        if (params.action === 'count') {
          expect(params.args).toStrictEqual({ skip: 1 })
        }

        return next(params)
      })

      await prisma.resource.count({ skip: 1 })
    })

    test('middleware with aggregate', async () => {
      expect.assertions(1)
      prisma.$use((params, next) => {
        if (params.action === 'aggregate') {
          expect(params.args).toStrictEqual({ skip: 1, _count: true })
        }

        return next(params)
      })

      await prisma.resource.aggregate({ skip: 1, _count: true })
    })

    test('middleware with groupBy', async () => {
      expect.assertions(1)
      prisma.$use((params, next) => {
        if (params.action === ('groupBy' as string)) {
          expect(params.args).toStrictEqual({ by: ['id'], orderBy: {} })
        }

        return next(params)
      })

      await prisma.resource.groupBy({ by: ['id'], orderBy: {} })
    })

    test('middleware with findFirst', async () => {
      expect.assertions(1)
      prisma.$use((params, next) => {
        if (params.action === 'findFirst') {
          expect(params.args).toStrictEqual({ take: 1 })
        }

        return next(params)
      })

      await prisma.resource.findFirst({ take: 1 })
    })

    test('middleware with findUnique', async () => {
      expect.assertions(1)
      prisma.$use((params, next) => {
        if (params.action === 'findUnique') {
          expect(params.args).toStrictEqual({ where: { id } })
        }

        return next(params)
      })

      await prisma.resource.findUnique({ where: { id } })
    })

    test('middleware with findFirstOrThrow', async () => {
      expect.assertions(1)
      prisma.$use((params, next) => {
        if (params.action === ('findFirstOrThrow' as string)) {
          expect(params.args).toStrictEqual({ take: 1 })
        }

        return next(params)
      })

      await prisma.resource.findFirstOrThrow({ take: 1 }).catch(() => {})
    })

    test('middleware with findUniqueOrThrow', async () => {
      expect.assertions(1)
      prisma.$use((params, next) => {
        if (params.action === ('findUniqueOrThrow' as string)) {
          expect(params.args).toStrictEqual({ where: { id } })
        }

        return next(params)
      })

      await prisma.resource.findUniqueOrThrow({ where: { id } }).catch(() => {})
    })

    test('middleware with create', async () => {
      expect.assertions(1)
      prisma.$use((params, next) => {
        if (params.action === 'create') {
          expect(params.args).toStrictEqual({ data: {} })
        }

        return next(params)
      })

      await prisma.resource.create({ data: {} })
    })

    test('middleware with delete', async () => {
      expect.assertions(1)
      prisma.$use((params, next) => {
        if (params.action === 'delete') {
          expect(params.args).toStrictEqual({ where: { id } })
        }

        return next(params)
      })

      await prisma.resource.delete({ where: { id } }).catch(() => {})
    })

    test('middleware with deleteMany', async () => {
      expect.assertions(1)
      prisma.$use((params, next) => {
        if (params.action === 'deleteMany') {
          expect(params.args).toStrictEqual({ where: { id } })
        }

        return next(params)
      })

      await prisma.resource.deleteMany({ where: { id } })
    })

    test('middleware with findMany', async () => {
      expect.assertions(1)
      prisma.$use((params, next) => {
        if (params.action === 'findMany') {
          expect(params.args).toStrictEqual({ where: { id } })
        }

        return next(params)
      })

      await prisma.resource.findMany({ where: { id } })
    })

    test('middleware with update', async () => {
      expect.assertions(1)
      prisma.$use((params, next) => {
        if (params.action === 'update') {
          expect(params.args).toStrictEqual({ where: { id }, data: {} })
        }

        return next(params)
      })

      await prisma.resource.update({ where: { id }, data: {} }).catch(() => {})
    })

    test('middleware with updateMany', async () => {
      expect.assertions(1)
      prisma.$use((params, next) => {
        if (params.action === 'updateMany') {
          expect(params.args).toStrictEqual({ where: { id }, data: {} })
        }

        return next(params)
      })

      await prisma.resource.updateMany({ where: { id }, data: {} })
    })

    test('middleware with upsert', async () => {
      expect.assertions(1)
      prisma.$use((params, next) => {
        if (params.action === 'upsert') {
          expect(params.args).toStrictEqual({ where: { id }, create: {}, update: {} })
        }

        return next(params)
      })

      await prisma.resource.upsert({ where: { id }, create: {}, update: {} })
    })

    testIf(provider === 'mongodb')('middleware with runCommandRaw', async () => {
      expect.assertions(1)
      prisma.$use((params, next) => {
        if (params.action === 'runCommandRaw') {
          expect(params.args).toStrictEqual({
            aggregate: 'Resource',
            pipeline: [{ $match: { id } }, { $project: { _id: true } }],
            explain: false,
          })
        }

        return next(params)
      })

      // @ts-test-if: provider === 'mongodb'
      await prisma.$runCommandRaw({
        aggregate: 'Resource',
        pipeline: [{ $match: { id } }, { $project: { _id: true } }],
        explain: false,
      })
    })
  },
  {
    optOut: {
      from: ['cockroachdb', 'mysql', 'postgresql', 'sqlserver'],
      reason: 'Testing on a single provider is enough for testing this issue',
    },
  },
)
