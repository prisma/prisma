import testMatrix from './_matrix'
// @ts-ignore
import type { PrismaClient } from './node_modules/@prisma/client'

declare let prisma: PrismaClient

/**
 * Regression test for #12003
 * Order by self relation
 */
testMatrix.setupTestSuite((suiteConfig, suiteMeta) => {
  test('findFirst', async () => {
    await prisma.parent.findFirst({
      orderBy: {
        resource: {
          dependsOn: {
            id: 'asc',
          },
        },
      },
    })
  })

  test('findMany', async () => {
    await prisma.parent.findMany({
      orderBy: {
        resource: {
          dependsOn: {
            id: 'asc',
          },
        },
      },
    })
  })

  test('aggregate', async () => {
    await prisma.parent.aggregate({
      _count: {
        _all: true,
      },
      orderBy: {
        resource: {
          dependsOn: {
            id: 'asc',
          },
        },
      },
    })
  })

  // api not available for groupBy
  test.skip('groupBy', async () => {
    await prisma.parent.groupBy({
      orderBy: {
        // @ts-expect-error
        resource: {
          dependsOn: {
            id: 'asc',
          },
        },
      },
    })
  })
})
