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

Invalid \`prisma.user.findMany()\` invocation in
/client/src/__tests__/integration/happy/interactive-transactions/test.ts:0:0

  39 
  40 await new Promise((res) => setTimeout(res, 6000))
  41 
→ 42 return prisma.user.findMany(
  Transaction API error: Transaction already closed: Transaction is no longer valid. Last state: 'Expired'.
`)
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

        return prisma.user.findMany()
      },
      {
        maxWait: 200,
        timeout: 500,
      },
    )

    await expect(result).rejects.toThrowErrorMatchingInlineSnapshot(`

Invalid \`prisma.user.findMany()\` invocation in
/client/src/__tests__/integration/happy/interactive-transactions/test.ts:0:0

   69 
   70 await new Promise((res) => setTimeout(res, 600))
   71 
→  72 return prisma.user.findMany(
  Transaction API error: Transaction already closed: Transaction is no longer valid. Last state: 'Expired'.
`)
  })

  /**
   * Transactions should fail if they time out on `maxWait`
   */
  test.skip('maxWait override', async () => {
    const result = prisma.$transaction(
      async (prisma) => {
        await prisma.user.create({
          data: {
            email: 'user_1@website.com',
          },
        })

        await new Promise((res) => setTimeout(res, 5))

        return prisma.user.findMany()
      },
      {
        maxWait: 0,
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
   * // TODO this does not behave the same for all dbs (sqlite)
   */
  test.skip('nested create', async () => {
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

Invalid \`prisma.user.create()\` invocation in
/client/src/__tests__/integration/happy/interactive-transactions/test.ts:0:0

  209   },
  210 })
  211 
→ 212 await prisma.user.create(
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

Invalid \`transactionBoundPrisma.user.create()\` invocation in
/client/src/__tests__/integration/happy/interactive-transactions/test.ts:0:0

  243 })
  244 
  245 const result = prisma.$transaction(async () => {
→ 246   await transactionBoundPrisma.user.create(
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

Invalid \`prisma.user.create()\` invocation in
/client/src/__tests__/integration/happy/interactive-transactions/test.ts:0:0

  294  */
  295 test('batching rollback', async () => {
  296   const result = prisma.$transaction([
→ 297     prisma.user.create(
  Unique constraint failed on the fields: (\`email\`)
`)

    const users = await prisma.user.findMany()

    expect(users.length).toBe(0)
  })

  /**
   * A bad batch should rollback using the interactive transaction logic
   */
  test('batching raw rollback', async () => {
    await prisma.user.create({
      data: {
        email: 'user_1@website.com',
      },
    })

    const result = prisma.$transaction([
      prisma.$executeRaw`INSERT INTO User (id, email) VALUES ("2", "user_2@website.com")`,
      prisma.$queryRaw`DELETE FROM User`,
      prisma.$executeRaw`INSERT INTO User (id, email) VALUES ("1", "user_1@website.com")`,
      prisma.$executeRaw`INSERT INTO User (id, email) VALUES ("1", "user_1@website.com")`,
    ])

    await expect(result).rejects.toThrowErrorMatchingInlineSnapshot(`

Invalid \`prisma.executeRaw()\` invocation:


  Raw query failed. Code: \`2067\`. Message: \`UNIQUE constraint failed: User.email\`
`)

    const users = await prisma.user.findMany()

    expect(users.length).toBe(1)
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

Invalid \`prisma.user.create()\` invocation in
/client/src/__tests__/integration/happy/interactive-transactions/test.ts:0:0

  392 })
  393 
  394 const result = prisma.$transaction([
→ 395   prisma.user.create(
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
})

beforeEach(async () => {
  prisma = new PrismaClient()

  await prisma.user.deleteMany()
})

afterEach(async () => {
  await prisma.$disconnect()
})
