import testMatrix from './_matrix'
// @ts-ignore
import type { PrismaClient } from './node_modules/@prisma/client'

declare let prisma: PrismaClient

testMatrix.setupTestSuite(
  (suiteConfig, suiteMeta) => {
    test('middleware with count', async () => {
      prisma.$use((params, next) => {
        if (params.action === 'count') {
          expect(params.args).toStrictEqual({ skip: 1 })
        }

        return next(params)
      })

      await prisma.resource.count({ skip: 1 })
    })

    test('middleware with aggregate', async () => {
      prisma.$use((params, next) => {
        if (params.action === 'aggregate') {
          expect(params.args).toStrictEqual({ skip: 1 })
        }

        return next(params)
      })

      await prisma.resource.aggregate({ skip: 1 })
    })

    test('middleware with groupBy', async () => {
      prisma.$use((params, next) => {
        if (params.action === ('groupBy' as string)) {
          expect(params.args).toStrictEqual({ by: ['id'], orderBy: {} })
        }

        return next(params)
      })

      await prisma.resource.groupBy({ by: ['id'], orderBy: {} })
    })

    test('middleware with findFirst', async () => {
      prisma.$use((params, next) => {
        if (params.action === 'findFirst') {
          expect(params.args).toStrictEqual({ take: 1 })
        }

        return next(params)
      })

      await prisma.resource.findFirst({ take: 1 })
    })

    test('middleware with findUnique', async () => {
      prisma.$use((params, next) => {
        if (params.action === 'findUnique') {
          expect(params.args).toStrictEqual({ where: { id: '0' } })
        }

        return next(params)
      })

      await prisma.resource.findUnique({ where: { id: '0' } })
    })

    test('middleware with findFirstOrThrow', async () => {
      prisma.$use((params, next) => {
        if (params.action === ('findFirstOrThrow' as string)) {
          expect(params.args).toStrictEqual({ take: 1 })
        }

        return next(params)
      })

      await prisma.resource.findFirstOrThrow({ take: 1 }).catch(() => {})
    })

    test('middleware with findUniqueOrThrow', async () => {
      prisma.$use((params, next) => {
        if (params.action === ('findUniqueOrThrow' as string)) {
          expect(params.args).toStrictEqual({ where: { id: '0' } })
        }

        return next(params)
      })

      await prisma.resource.findUniqueOrThrow({ where: { id: '0' } }).catch(() => {})
    })

    test('middleware with create', async () => {
      prisma.$use((params, next) => {
        if (params.action === 'create') {
          expect(params.args).toStrictEqual({ data: {} })
        }

        return next(params)
      })

      await prisma.resource.create({ data: {} })
    })

    test('middleware with delete', async () => {
      prisma.$use((params, next) => {
        if (params.action === 'delete') {
          expect(params.args).toStrictEqual({ where: { id: '0' } })
        }

        return next(params)
      })

      await prisma.resource.delete({ where: { id: '0' } }).catch(() => {})
    })

    test('middleware with deleteMany', async () => {
      prisma.$use((params, next) => {
        if (params.action === 'deleteMany') {
          expect(params.args).toStrictEqual({ where: { id: '0' } })
        }

        return next(params)
      })

      await prisma.resource.deleteMany({ where: { id: '0' } })
    })

    test('middleware with findMany', async () => {
      prisma.$use((params, next) => {
        if (params.action === 'findMany') {
          expect(params.args).toStrictEqual({ where: { id: '0' } })
        }

        return next(params)
      })

      await prisma.resource.findMany({ where: { id: '0' } })
    })

    test('middleware with update', async () => {
      prisma.$use((params, next) => {
        if (params.action === 'update') {
          expect(params.args).toStrictEqual({ where: { id: '0' }, data: {} })
        }

        return next(params)
      })

      await prisma.resource.update({ where: { id: '0' }, data: {} }).catch(() => {})
    })

    test('middleware with updateMany', async () => {
      prisma.$use((params, next) => {
        if (params.action === 'updateMany') {
          expect(params.args).toStrictEqual({ where: { id: '0' }, data: {} })
        }

        return next(params)
      })

      await prisma.resource.updateMany({ where: { id: '0' }, data: {} })
    })

    test('middleware with upsert', async () => {
      prisma.$use((params, next) => {
        if (params.action === 'upsert') {
          expect(params.args).toStrictEqual({ where: { id: '0' }, create: {}, update: {} })
        }

        return next(params)
      })

      await prisma.resource.upsert({ where: { id: '0' }, create: {}, update: {} })
    })
  },
  {
    optOut: {
      from: ['cockroachdb', 'mongodb', 'mysql', 'postgresql', 'sqlserver'],
      reason: 'Testing on a single provider is enough for testing this issue',
    },
  },
)
