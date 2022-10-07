import { ClientEngineType, getClientEngineType } from '@prisma/internals'

import { NewPrismaClient } from '../_utils/types'
import testMatrix from './_matrix'
// @ts-ignore
import type { Prisma as PrismaNamespace, PrismaClient } from './node_modules/@prisma/client'

declare let prisma: PrismaClient
declare let Prisma: typeof PrismaNamespace
declare let newPrismaClient: NewPrismaClient<typeof PrismaClient>

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

testMatrix.setupTestSuite(({ provider }) => {
  // TODO: Technically, only "high concurrency" test requires larger timeout
  // but `jest.setTimeout` does not work inside of the test at the moment
  //  https://github.com/facebook/jest/issues/11543
  jest.setTimeout(60_000)

  beforeEach(async () => {
    await prisma.user.deleteMany()
  })

  /**
   * Minimal example of an interactive transaction
   */
  test('basic', async () => {
    const result = await prisma.$transaction(async (prisma) => {
      await prisma.user.create({
        data: {
          email: 'user_1@website.com',
        },
      })

      await prisma.user.create({
        data: {
          email: 'user_2@website.com',
        },
      })

      return prisma.user.findMany()
    })

    expect(result.length).toBe(2)
  })

  /**
   * Transactions should fail after the default timeout
   */
  test('timeout default', async () => {
    const result = prisma.$transaction(async (prisma) => {
      await prisma.user.create({
        data: {
          email: 'user_1@website.com',
        },
      })

      await delay(6000)
    })

    await expect(result).rejects.toMatchObject({
      message: expect.stringContaining('Transaction API error: Transaction already closed'),
      code: 'P2028',
      clientVersion: '0.0.0',
    })

    expect(await prisma.user.findMany()).toHaveLength(0)
  })

  /**
   * Transactions should fail if they time out on `timeout`
   */
  test('timeout override', async () => {
    const result = prisma.$transaction(
      async (prisma) => {
        await prisma.user.create({
          data: {
            email: 'user_1@website.com',
          },
        })

        await new Promise((res) => setTimeout(res, 600))
      },
      {
        maxWait: 200,
        timeout: 500,
      },
    )

    await expect(result).rejects.toMatchObject({
      message: expect.stringContaining('Transaction API error: Transaction already closed'),
    })

    expect(await prisma.user.findMany()).toHaveLength(0)
  })

  /**
   * Transactions should fail and rollback if thrown within
   */
  test('rollback throw', async () => {
    const result = prisma.$transaction(async (prisma) => {
      await prisma.user.create({
        data: {
          email: 'user_1@website.com',
        },
      })

      throw new Error('you better rollback now')
    })

    await expect(result).rejects.toThrowErrorMatchingInlineSnapshot(`you better rollback now`)

    const users = await prisma.user.findMany()

    expect(users.length).toBe(0)
  })

  /**
   * Transactions should fail and rollback if a value is thrown within
   */
  test('rollback throw value', async () => {
    const result = prisma.$transaction(async (prisma) => {
      await prisma.user.create({
        data: {
          email: 'user_1@website.com',
        },
      })

      throw 'you better rollback now'
    })

    await expect(result).rejects.toBe(`you better rollback now`)

    const users = await prisma.user.findMany()

    expect(users.length).toBe(0)
  })

  /**
   * A transaction might fail if it's called inside another transaction
   * //! this works only for postgresql
   */
  testIf(provider === 'postgresql')('postgresql: nested create', async () => {
    const result = prisma.$transaction(async (tx) => {
      await tx.user.create({
        data: {
          email: 'user_1@website.com',
        },
      })

      await prisma.$transaction(async (tx) => {
        await tx.user.create({
          data: {
            email: 'user_2@website.com',
          },
        })
      })

      return tx.user.findMany()
    })

    await expect(result).resolves.toHaveLength(2)
  })

  /**
   * We don't allow certain methods to be called in a transaction
   */
  test('forbidden', async () => {
    const forbidden = ['$connect', '$disconnect', '$on', '$transaction', '$use']
    expect.assertions(forbidden.length + 1)

    const result = prisma.$transaction((prisma) => {
      for (const method of forbidden) {
        expect(prisma).not.toHaveProperty(method)
      }
      return Promise.resolve()
    })

    await expect(result).resolves.toBe(undefined)
  })

  /**
   * If one of the query fails, all queries should cancel
   */
  test('rollback query', async () => {
    const result = prisma.$transaction(async (prisma) => {
      await prisma.user.create({
        data: {
          email: 'user_1@website.com',
        },
      })

      await prisma.user.create({
        data: {
          email: 'user_1@website.com',
        },
      })
    })

    await expect(result).rejects.toMatchPrismaErrorSnapshot()

    const users = await prisma.user.findMany()

    expect(users.length).toBe(0)
  })

  test('already committed', async () => {
    let transactionBoundPrisma
    await prisma.$transaction((prisma) => {
      transactionBoundPrisma = prisma
      return Promise.resolve()
    })

    const result = prisma.$transaction(async () => {
      await transactionBoundPrisma.user.create({
        data: {
          email: 'user_1@website.com',
        },
      })
    })

    await expect(result).rejects.toMatchObject({
      message: expect.stringContaining('Transaction API error: Transaction already closed'),
      code: 'P2028',
      clientVersion: '0.0.0',
    })

    await expect(result).rejects.toMatchPrismaErrorInlineSnapshot(`

        Invalid \`transactionBoundPrisma.user.create()\` invocation in
        /client/tests/functional/interactive-transactions/tests.ts:0:0

          XX })
          XX 
          XX const result = prisma.$transaction(async () => {
        → XX   await transactionBoundPrisma.user.create(
        Transaction API error: Transaction already closed: A query cannot be executed on a closed transaction..
      `)

    const users = await prisma.user.findMany()

    expect(users.length).toBe(0)
  })

  /**
   * Batching should work with using the interactive transaction logic
   */
  test('batching', async () => {
    await prisma.$transaction([
      prisma.user.create({
        data: {
          email: 'user_1@website.com',
        },
      }),
      prisma.user.create({
        data: {
          email: 'user_2@website.com',
        },
      }),
    ])

    const users = await prisma.user.findMany()

    expect(users.length).toBe(2)
  })

  /**
   * A bad batch should rollback using the interactive transaction logic
   * // TODO: skipped because output differs from binary to library
   */
  testIf(getClientEngineType() === ClientEngineType.Library)('batching rollback', async () => {
    const result = prisma.$transaction([
      prisma.user.create({
        data: {
          email: 'user_1@website.com',
        },
      }),
      prisma.user.create({
        data: {
          email: 'user_1@website.com',
        },
      }),
    ])

    await expect(result).rejects.toMatchPrismaErrorSnapshot()

    const users = await prisma.user.findMany()

    expect(users.length).toBe(0)
  })

  /**
   * A bad batch should rollback using the interactive transaction logic
   * // TODO: skipped because output differs from binary to library
   */
  testIf(getClientEngineType() === ClientEngineType.Library && provider !== 'mongodb')(
    'batching raw rollback',
    async () => {
      await prisma.user.create({
        data: {
          id: '1',
          email: 'user_1@website.com',
        },
      })

      const result =
        provider === 'mysql'
          ? prisma.$transaction([
              // @ts-test-if: provider !== 'mongodb'
              prisma.$executeRaw`INSERT INTO User (id, email) VALUES (${'2'}, ${'user_2@website.com'})`,
              // @ts-test-if: provider !== 'mongodb'
              prisma.$queryRaw`DELETE FROM User`,
              // @ts-test-if: provider !== 'mongodb'
              prisma.$executeRaw`INSERT INTO User (id, email) VALUES (${'1'}, ${'user_1@website.com'})`,
              // @ts-test-if: provider !== 'mongodb'
              prisma.$executeRaw`INSERT INTO User (id, email) VALUES (${'1'}, ${'user_1@website.com'})`,
            ])
          : prisma.$transaction([
              // @ts-test-if: provider !== 'mongodb'
              prisma.$executeRaw`INSERT INTO "User" (id, email) VALUES (${'2'}, ${'user_2@website.com'})`,
              // @ts-test-if: provider !== 'mongodb'
              prisma.$queryRaw`DELETE FROM "User"`,
              // @ts-test-if: provider !== 'mongodb'
              prisma.$executeRaw`INSERT INTO "User" (id, email) VALUES (${'1'}, ${'user_1@website.com'})`,
              // @ts-test-if: provider !== 'mongodb'
              prisma.$executeRaw`INSERT INTO "User" (id, email) VALUES (${'1'}, ${'user_1@website.com'})`,
            ])

      await expect(result).rejects.toMatchPrismaErrorSnapshot()

      const users = await prisma.user.findMany()

      expect(users.length).toBe(1)
    },
  )

  // running this test on isolated prisma instance since
  // middleware change the return values of model methods
  // and this would affect subsequent tests if run on a main instance
  describe('middlewares', () => {
    /**
     * Minimal example of a interactive transaction & middleware
     */
    test('middleware basic', async () => {
      const isolatedPrisma = newPrismaClient()
      let runInTransaction = false

      isolatedPrisma.$use(async (params, next) => {
        await next(params)

        runInTransaction = params.runInTransaction

        return 'result'
      })

      const result = await isolatedPrisma.$transaction((prisma) => {
        return prisma.user.create({
          data: {
            email: 'user_1@website.com',
          },
        })
      })

      expect(result).toBe('result')
      expect(runInTransaction).toBe(true)
    })

    /**
     * Middlewares should work normally on batches
     */
    test('middlewares batching', async () => {
      const isolatedPrisma = newPrismaClient()
      isolatedPrisma.$use(async (params, next) => {
        const result = await next(params)

        return result
      })

      await isolatedPrisma.$transaction([
        prisma.user.create({
          data: {
            email: 'user_1@website.com',
          },
        }),
        prisma.user.create({
          data: {
            email: 'user_2@website.com',
          },
        }),
      ])

      const users = await prisma.user.findMany()

      expect(users.length).toBe(2)
    })

    test('middleware exclude from transaction', async () => {
      const isolatedPrisma = newPrismaClient()

      isolatedPrisma.$use((params, next) => {
        return next({ ...params, runInTransaction: false })
      })

      await isolatedPrisma
        .$transaction(async (prisma) => {
          await prisma.user.create({
            data: {
              email: 'user_1@website.com',
            },
          })

          await prisma.user.create({
            data: {
              email: 'user_1@website.com',
            },
          })
        })
        .catch((e) => {})

      const users = await isolatedPrisma.user.findMany()
      expect(users).toHaveLength(1)
    })
  })

  /**
   * Two concurrent transactions should work
   */
  test('concurrent', async () => {
    await Promise.all([
      prisma.$transaction([
        prisma.user.create({
          data: {
            email: 'user_1@website.com',
          },
        }),
      ]),
      prisma.$transaction([
        prisma.user.create({
          data: {
            email: 'user_2@website.com',
          },
        }),
      ]),
    ])

    const users = await prisma.user.findMany()

    expect(users.length).toBe(2)
  })

  /**
   * Makes sure that the engine does not deadlock
   * For sqlite, it sometimes causes DB lock up and all subsequent
   * tests fail. We might want to re-enable it either after we implemented
   * WAL mode (https://github.com/prisma/prisma/issues/3303) or identified the
   * issue on our side
   */
  testIf(provider !== 'sqlite')('high concurrency', async () => {
    jest.setTimeout(30_000)

    await prisma.user.create({
      data: {
        email: 'x',
        name: 'y',
      },
    })

    for (let i = 0; i < 5; i++) {
      await Promise.allSettled([
        prisma.$transaction((tx) => tx.user.update({ data: { name: 'a' }, where: { email: 'x' } }), { timeout: 25 }),
        prisma.$transaction((tx) => tx.user.update({ data: { name: 'b' }, where: { email: 'x' } }), { timeout: 25 }),
        prisma.$transaction((tx) => tx.user.update({ data: { name: 'c' }, where: { email: 'x' } }), { timeout: 25 }),
        prisma.$transaction((tx) => tx.user.update({ data: { name: 'd' }, where: { email: 'x' } }), { timeout: 25 }),
        prisma.$transaction((tx) => tx.user.update({ data: { name: 'e' }, where: { email: 'x' } }), { timeout: 25 }),
        prisma.$transaction((tx) => tx.user.update({ data: { name: 'f' }, where: { email: 'x' } }), { timeout: 25 }),
        prisma.$transaction((tx) => tx.user.update({ data: { name: 'g' }, where: { email: 'x' } }), { timeout: 25 }),
        prisma.$transaction((tx) => tx.user.update({ data: { name: 'h' }, where: { email: 'x' } }), { timeout: 25 }),
        prisma.$transaction((tx) => tx.user.update({ data: { name: 'i' }, where: { email: 'x' } }), { timeout: 25 }),
        prisma.$transaction((tx) => tx.user.update({ data: { name: 'j' }, where: { email: 'x' } }), { timeout: 25 }),
      ]).catch(() => {}) // we don't care for errors, there will be
    }
  })

  /**
   * Rollback should happen even with `then` calls
   */
  test('rollback with then calls', async () => {
    const result = prisma.$transaction(async (prisma) => {
      await prisma.user
        .create({
          data: {
            email: 'user_1@website.com',
          },
        })
        .then()

      await prisma.user
        .create({
          data: {
            email: 'user_2@website.com',
          },
        })
        .then()
        .then()

      throw new Error('rollback')
    })

    await expect(result).rejects.toThrowErrorMatchingInlineSnapshot(`rollback`)

    const users = await prisma.user.findMany()

    expect(users.length).toBe(0)
  })

  /**
   * Rollback should happen even with `catch` calls
   */
  test('rollback with catch calls', async () => {
    const result = prisma.$transaction(async (prisma) => {
      await prisma.user
        .create({
          data: {
            email: 'user_1@website.com',
          },
        })
        .catch()
      await prisma.user
        .create({
          data: {
            email: 'user_2@website.com',
          },
        })
        .catch()
        .then()

      throw new Error('rollback')
    })

    await expect(result).rejects.toThrowErrorMatchingInlineSnapshot(`rollback`)

    const users = await prisma.user.findMany()

    expect(users.length).toBe(0)
  })

  /**
   * Rollback should happen even with `finally` calls
   */
  test('rollback with finally calls', async () => {
    const result = prisma.$transaction(async (prisma) => {
      await prisma.user
        .create({
          data: {
            email: 'user_1@website.com',
          },
        })
        .finally()

      await prisma.user
        .create({
          data: {
            email: 'user_2@website.com',
          },
        })
        .then()
        .catch()
        .finally()

      throw new Error('rollback')
    })

    await expect(result).rejects.toThrowErrorMatchingInlineSnapshot(`rollback`)

    const users = await prisma.user.findMany()

    expect(users.length).toBe(0)
  })

  /**
   * Makes sure that the engine can process when the transaction has locks inside
   * Engine PR - https://github.com/prisma/prisma-engines/pull/2811
   * Issue - https://github.com/prisma/prisma/issues/11750
   */
  testIf(provider === 'postgresql')('high concurrency with SET FOR UPDATE', async () => {
    jest.setTimeout(60_000)
    const CONCURRENCY = 12

    await prisma.user.create({
      data: {
        email: 'x',
        name: 'y',
        val: 1,
      },
    })

    const promises = [...Array(CONCURRENCY)].map(() =>
      prisma.$transaction(
        async (transactionPrisma) => {
          // @ts-test-if: provider !== 'mongodb'
          await transactionPrisma.$queryRaw`SELECT id from "User" where email = 'x' FOR UPDATE`

          const user = await transactionPrisma.user.findUnique({
            rejectOnNotFound: true,
            where: {
              email: 'x',
            },
          })

          // Add a delay here to force the transaction to be open for longer
          // this will increase the chance of deadlock in the itx transactions
          // if deadlock is a possibility.
          await delay(100)

          const updatedUser = await transactionPrisma.user.update({
            where: {
              email: 'x',
            },
            data: {
              val: user.val! + 1,
            },
          })

          return updatedUser
        },
        { timeout: 60000, maxWait: 60000 },
      ),
    )

    await Promise.allSettled(promises)

    const finalUser = await prisma.user.findUnique({
      rejectOnNotFound: true,
      where: {
        email: 'x',
      },
    })

    expect(finalUser.val).toEqual(CONCURRENCY + 1)
  })

  describeIf(provider !== 'mongodb')('isolation levels', () => {
    /* eslint-disable jest/no-standalone-expect */
    function testIsolationLevel(title: string, supported: boolean, fn: () => Promise<void>) {
      test(title, async () => {
        if (supported) {
          await fn()
        } else {
          await expect(fn()).rejects.toThrowError('Invalid enum value')
        }
      })
    }

    testIsolationLevel('read committed', provider !== 'sqlite' && provider !== 'cockroachdb', async () => {
      await prisma.$transaction(
        async (tx) => {
          await tx.user.create({ data: { email: 'user@example.com' } })
        },
        {
          // @ts-test-if: !['mongodb', 'sqlite', 'cockroachdb'].includes(provider)
          isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted,
        },
      )
      await expect(prisma.user.findMany()).resolves.toHaveLength(1)
    })

    testIsolationLevel('read uncommitted', provider !== 'sqlite' && provider !== 'cockroachdb', async () => {
      await prisma.$transaction(
        async (tx) => {
          await tx.user.create({ data: { email: 'user@example.com' } })
        },
        {
          // @ts-test-if: !['mongodb', 'sqlite', 'cockroachdb'].includes(provider)
          isolationLevel: Prisma.TransactionIsolationLevel.ReadUncommitted,
        },
      )
      await expect(prisma.user.findMany()).resolves.toHaveLength(1)
    })

    testIsolationLevel('repeatable read', provider !== 'sqlite' && provider !== 'cockroachdb', async () => {
      await prisma.$transaction(
        async (tx) => {
          await tx.user.create({ data: { email: 'user@example.com' } })
        },
        {
          // @ts-test-if: !['mongodb', 'sqlite', 'cockroachdb'].includes(provider)
          isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead,
        },
      )
      await expect(prisma.user.findMany()).resolves.toHaveLength(1)
    })

    testIsolationLevel('serializable', true, async () => {
      await prisma.$transaction(
        async (tx) => {
          await tx.user.create({ data: { email: 'user@example.com' } })
        },
        {
          // @ts-test-if: provider !== 'mongodb'
          isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
        },
      )

      await expect(prisma.user.findMany()).resolves.toHaveLength(1)
    })

    // TODO: there is also Snapshot level for sqlserver
    // it needs to be explicitly enabled on DB level and test setup can't do it at the moment
    // ref: https://docs.microsoft.com/en-us/troubleshoot/sql/analysis-services/enable-snapshot-transaction-isolation-level
    // testIsolationLevel('snapshot', provider === 'sqlserver', async () => {
    //   await prisma.$transaction(
    //     async (tx) => {
    //       await tx.user.create({ data: { email: 'user@example.com' } })
    //     },
    //     {
    //       // @ts-test-if: provider === 'sqlserver'
    //       isolationLevel: Prisma.TransactionIsolationLevel.Snapshot,
    //     },
    //   )

    //   await expect(prisma.user.findMany()).resolves.toHaveLength(1)
    // })

    test('invalid value', async () => {
      // @ts-test-if: provider === 'mongodb'
      const result = prisma.$transaction(
        async (tx) => {
          await tx.user.create({ data: { email: 'user@example.com' } })
        },
        {
          // @ts-test-if: provider !== 'mongodb'
          isolationLevel: 'NotAValidLevel',
        },
      )

      await expect(result).rejects.toMatchObject({
        code: 'P2023',
        clientVersion: '0.0.0',
      })

      await expect(result).rejects.toThrowErrorMatchingInlineSnapshot(
        `Inconsistent column data: Conversion failed: Invalid isolation level \`NotAValidLevel\``,
      )
    })
    /* eslint-enable jest/no-standalone-expect */
  })

  testIf(provider === 'mongodb')('attempt to set isolation level on mongo', async () => {
    // @ts-test-if: provider === 'mongodb'
    const result = prisma.$transaction(
      async (tx) => {
        await tx.user.create({ data: { email: 'user@example.com' } })
      },
      {
        // @ts-test-if: provider !== 'mongodb'
        isolationLevel: 'CanBeAnything',
      },
    )

    await expect(result).rejects.toThrowErrorMatchingInlineSnapshot(
      `The current database provider doesn't support a feature that the query used: Mongo does not support setting transaction isolation levels.`,
    )
  })
})
