import { getTestClient } from '../../../../utils/getTestClient'

let PrismaClient, prisma

describe('interactive transaction', () => {
  /**
   * Minimal example of a interactive transaction
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

      await new Promise((res) => setTimeout(res, 6000))

      return prisma.user.findMany()
    })

    await expect(result).rejects.toThrowErrorMatchingInlineSnapshot(`

            Invalid \`prisma.user.findMany()\` invocation:


              Transaction API error: Transaction already closed: Transaction is no longer valid. Last state: 'Expired'.
          `)
  })

  /**
   * Transactions should fail after the changed timeout
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

        return prisma.user.findMany()
      },
      {
        maxWait: 200,
        timeout: 500,
      },
    )

    await expect(result).rejects.toThrowErrorMatchingInlineSnapshot(`

            Invalid \`prisma.user.findMany()\` invocation:


              Transaction API error: Transaction already closed: Transaction is no longer valid. Last state: 'Expired'.
          `)
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

    await expect(result).rejects.toThrowErrorMatchingInlineSnapshot(
      `you better rollback now`,
    )

    const users = await prisma.user.findMany()

    expect(users.length).toBe(0)
  })

  /**
   * A transaction might fail if it's called inside another transaction
   */
  test('nested create', async () => {
    const result = prisma.$transaction(async (tx) => {
      await tx.user.create({
        data: {
          email: 'user_1@website.com',
        },
      })

      await prisma.$transaction(
        async (prisma) => {
          await prisma.user.create({
            data: {
              email: 'user_2@website.com',
            },
          })
        },
        {
          timeout: 1000,
        },
      )

      return tx.user.findMany()
    })

    await expect(result).rejects.toThrowErrorMatchingInlineSnapshot(`

            Invalid \`prisma.user.findMany()\` invocation:


              Transaction API error: Transaction already closed: Transaction is no longer valid. Last state: 'Expired'.
          `)

    const users = await prisma.user.findMany()

    expect(users.length).toBe(0)
  })

  /**
   * We don't allow certain methods to be called in a transaction
   */
  test('forbidden', async () => {
    const forbidden = ['$connect', '$disconnect', '$on', '$transaction', '$use']

    const result = prisma.$transaction((prisma) => {
      // we accumulate all the forbidden methods and expect to be undefined
      return forbidden.reduce((acc, item) => acc ?? prisma[item], undefined)
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

    await expect(result).rejects.toThrowErrorMatchingInlineSnapshot(`

            Invalid \`prisma.user.create()\` invocation:


              Unique constraint failed on the fields: (\`email\`)
          `)

    const users = await prisma.user.findMany()

    expect(users.length).toBe(0)
  })

  /**
   * A transaction that is already 'commit' cannot be reused
   */
  test('already committed', async () => {
    let transactionBoundPrisma
    await prisma.$transaction((prisma) => {
      transactionBoundPrisma = prisma
    })

    const result = prisma.$transaction(async () => {
      await transactionBoundPrisma.user.create({
        data: {
          email: 'user_1@website.com',
        },
      })
    })

    await expect(result).rejects.toThrowErrorMatchingInlineSnapshot(`

            Invalid \`prisma.user.create()\` invocation:


              Transaction API error: Transaction already closed: Transaction is no longer valid. Last state: 'Committed'.
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
   */
  test('batching rollback', async () => {
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

    await expect(result).rejects.toThrowErrorMatchingInlineSnapshot(`

Invalid \`prisma.user.create()\` invocation:


  Unique constraint failed on the fields: (\`email\`)
`)

    const users = await prisma.user.findMany()

    expect(users.length).toBe(0)
  })

  /**
   * Middlewares should work normally on batches
   */
  test('middlewares batching', async () => {
    prisma.$use(async (params, next) => {
      const result = await next(params)

      return result
    })

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
   * Middlewares should not prevent a rollback
   */
  test('middlewares batching rollback', async () => {
    prisma.$use(async (params, next) => {
      const result = await next(params)

      return result
    })

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

    await expect(result).rejects.toThrowErrorMatchingInlineSnapshot(`

Invalid \`prisma.user.create()\` invocation:


  Unique constraint failed on the fields: (\`email\`)
`)

    const users = await prisma.user.findMany()

    expect(users.length).toBe(0)
  })

  /**
   * Minimal example of a interactive transaction & middleware
   */
  test('middleware basic', async () => {
    prisma.$use(async (params, next) => {
      await next(params)

      return 'result'
    })

    const result = await prisma.$transaction((prisma) => {
      return prisma.user.create({
        data: {
          email: 'user_1@website.com',
        },
      })
    })

    expect(result).toBe('result')
  })
})

beforeAll(async () => {
  PrismaClient = await getTestClient()

  process.env.PRISMA_FORCE_LRT = 'true'
})

afterAll(() => {
  delete process.env.PRISMA_FORCE_LRT
})

beforeEach(async () => {
  prisma = new PrismaClient()

  await prisma.user.deleteMany()
})

afterEach(async () => {
  await prisma.$disconnect()
})
