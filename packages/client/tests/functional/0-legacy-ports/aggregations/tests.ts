import { copycat } from '@snaplet/copycat'

import testMatrix from './_matrix'
// @ts-ignore
import type { PrismaClient } from './node_modules/@prisma/client'

declare let prisma: PrismaClient

testMatrix.setupTestSuite((_1, _2, clientMeta) => {
  beforeAll(async () => {
    await prisma.user.create({
      data: {
        email: copycat.email(51),
        age: 20,
      },
    })
    await prisma.user.create({
      data: {
        email: copycat.email(12),
        age: 45,
      },
    })
    await prisma.user.create({
      data: {
        email: copycat.email(36),
        age: 60,
      },
    })
    await prisma.user.create({
      data: {
        email: copycat.email(84),
        age: 63,
      },
    })
  })

  test('min', async () => {
    const result = await prisma.user.aggregate({
      _min: {
        age: true,
      },
    })

    expect(result).toMatchInlineSnapshot(`
      {
        _min: {
          age: 20,
        },
      }
    `)
  })

  test('max', async () => {
    const result = await prisma.user.aggregate({
      _max: {
        age: true,
      },
    })

    expect(result).toMatchInlineSnapshot(`
      {
        _max: {
          age: 63,
        },
      }
    `)
  })

  test('sum', async () => {
    const result = await prisma.user.aggregate({
      _sum: {
        age: true,
      },
    })

    expect(result).toMatchInlineSnapshot(`
      {
        _sum: {
          age: 188,
        },
      }
    `)
  })

  test('count inline boolean', async () => {
    const result = await prisma.user.aggregate({
      _count: true,
    })

    expect(result).toMatchInlineSnapshot(`
      {
        _count: 4,
      }
    `)
  })

  test('count with _all', async () => {
    const result = await prisma.user.aggregate({
      _count: {
        _all: true,
      },
    })

    expect(result).toMatchInlineSnapshot(`
      {
        _count: {
          _all: 4,
        },
      }
    `)
  })

  test('avg', async () => {
    const result = await prisma.user.aggregate({
      _avg: {
        age: true,
      },
    })

    expect(result).toMatchInlineSnapshot(`
      {
        _avg: {
          age: 47,
        },
      }
    `)
  })

  test('multiple aggregations', async () => {
    const result = await prisma.user.aggregate({
      _min: {
        age: true,
      },
      _max: {
        age: true,
      },
      _sum: {
        age: true,
      },
      _count: true,
      _avg: {
        age: true,
      },
    })

    expect(result).toMatchInlineSnapshot(`
      {
        _avg: {
          age: 47,
        },
        _count: 4,
        _max: {
          age: 63,
        },
        _min: {
          age: 20,
        },
        _sum: {
          age: 188,
        },
      }
    `)
  })

  test('multiple aggregations with where', async () => {
    const result = await prisma.user.aggregate({
      where: {
        age: {
          gt: 20,
        },
      },
      _min: {
        age: true,
      },
      _max: {
        age: true,
      },
      _sum: {
        age: true,
      },
      _count: {
        email: true,
      },
      _avg: {
        age: true,
      },
    })

    expect(result).toMatchInlineSnapshot(`
      {
        _avg: {
          age: 56,
        },
        _count: {
          email: 3,
        },
        _max: {
          age: 63,
        },
        _min: {
          age: 45,
        },
        _sum: {
          age: 168,
        },
      }
    `)
  })

  // skip because snapshots don't align between edge and node TODO: investigate
  testIf(clientMeta.runtime !== 'edge')('invalid min', async () => {
    const result = prisma.user.aggregate({
      _min: {
        // @ts-expect-error
        posts: true,
      },
    })

    await expect(result).rejects.toMatchPrismaErrorInlineSnapshot(`

      Invalid \`prisma.user.aggregate()\` invocation in
      /client/tests/functional/0-legacy-ports/aggregations/tests.ts:0:0

        XX 
        XX // skip because snapshots don't align between edge and node TODO: investigate
        XX testIf(clientMeta.runtime !== 'edge')('invalid min', async () => {
      → XX   const result = prisma.user.aggregate({
                select: {
                  _min: {
                    select: {
                      posts: true,
                      ~~~~~
              ?       id?: true,
              ?       email?: true,
              ?       age?: true,
              ?       name?: true
                    }
                  }
                }
              })

      Unknown field \`posts\` for select statement on model \`UserMinAggregateOutputType\`. Available options are marked with ?.
    `)
  })

  // skip because snapshots don't align between edge and node TODO: investigate
  testIf(clientMeta.runtime !== 'edge')('invalid max', async () => {
    const result = prisma.user.aggregate({
      _max: {
        // @ts-expect-error
        posts: true,
      },
    })

    await expect(result).rejects.toMatchPrismaErrorInlineSnapshot(`

      Invalid \`prisma.user.aggregate()\` invocation in
      /client/tests/functional/0-legacy-ports/aggregations/tests.ts:0:0

        XX 
        XX // skip because snapshots don't align between edge and node TODO: investigate
        XX testIf(clientMeta.runtime !== 'edge')('invalid max', async () => {
      → XX   const result = prisma.user.aggregate({
                select: {
                  _max: {
                    select: {
                      posts: true,
                      ~~~~~
              ?       id?: true,
              ?       email?: true,
              ?       age?: true,
              ?       name?: true
                    }
                  }
                }
              })

      Unknown field \`posts\` for select statement on model \`UserMaxAggregateOutputType\`. Available options are marked with ?.
    `)
  })

  // skip because snapshots don't align between edge and node TODO: investigate
  testIf(clientMeta.runtime !== 'edge')('invalid sum', async () => {
    const result = prisma.user.aggregate({
      _sum: {
        // @ts-expect-error
        email: true,
      },
    })

    await expect(result).rejects.toMatchPrismaErrorInlineSnapshot(`

      Invalid \`prisma.user.aggregate()\` invocation in
      /client/tests/functional/0-legacy-ports/aggregations/tests.ts:0:0

        XX 
        XX // skip because snapshots don't align between edge and node TODO: investigate
        XX testIf(clientMeta.runtime !== 'edge')('invalid sum', async () => {
      → XX   const result = prisma.user.aggregate({
                select: {
                  _sum: {
                    select: {
                      email: true,
                      ~~~~~
              ?       age?: true
                    }
                  }
                }
              })

      Unknown field \`email\` for select statement on model \`UserSumAggregateOutputType\`. Available options are marked with ?.
    `)
  })

  // skip because snapshots don't align between edge and node TODO: investigate
  testIf(clientMeta.runtime !== 'edge')('invalid count', async () => {
    const result = prisma.user.aggregate({
      _count: {
        // @ts-expect-error
        posts: true,
      },
    })

    await expect(result).rejects.toMatchPrismaErrorInlineSnapshot(`

      Invalid \`prisma.user.aggregate()\` invocation in
      /client/tests/functional/0-legacy-ports/aggregations/tests.ts:0:0

        XX 
        XX // skip because snapshots don't align between edge and node TODO: investigate
        XX testIf(clientMeta.runtime !== 'edge')('invalid count', async () => {
      → XX   const result = prisma.user.aggregate({
                select: {
                  _count: {
                    select: {
                      posts: true,
                      ~~~~~
              ?       id?: true,
              ?       email?: true,
              ?       age?: true,
              ?       name?: true,
              ?       _all?: true
                    }
                  }
                }
              })

      Unknown field \`posts\` for select statement on model \`UserCountAggregateOutputType\`. Available options are marked with ?.
    `)
  })

  // skip because snapshots don't align between edge and node TODO: investigate
  testIf(clientMeta.runtime !== 'edge')('invalid avg', async () => {
    const result = prisma.user.aggregate({
      _avg: {
        // @ts-expect-error
        email: true,
      },
    })

    await expect(result).rejects.toMatchPrismaErrorInlineSnapshot(`

      Invalid \`prisma.user.aggregate()\` invocation in
      /client/tests/functional/0-legacy-ports/aggregations/tests.ts:0:0

        XX 
        XX // skip because snapshots don't align between edge and node TODO: investigate
        XX testIf(clientMeta.runtime !== 'edge')('invalid avg', async () => {
      → XX   const result = prisma.user.aggregate({
                select: {
                  _avg: {
                    select: {
                      email: true,
                      ~~~~~
              ?       age?: true
                    }
                  }
                }
              })

      Unknown field \`email\` for select statement on model \`UserAvgAggregateOutputType\`. Available options are marked with ?.
    `)
  })
})
