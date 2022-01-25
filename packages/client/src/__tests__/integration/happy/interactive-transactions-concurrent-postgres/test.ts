import path from 'path'
import { getTestClient } from '../../../../utils/getTestClient'
import { tearDownPostgres } from '../../../../utils/setupPostgres'
import { migrateDb } from '../../__helpers__/migrateDb'

let PrismaClient, prisma

describe('interactive transaction', () => {
  /**
   * Two concurrent transactions should work
   */
  test('two concurrent', async () => {
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

  // This tests that the engine will not deadlock and hang when running this.
  // Some of the updates will fail with a transaction expired which is acceptable
  // The most important part of this test is that it completes.
  test('multiple concurrent transactions should work', async () => {
    jest.setTimeout(20000)
    const email = 'test@test.com'
    await seed(prisma, email)

    for (let i = 0; i < 5; i++) {
      await Promise.all([
        txUpdate(prisma, email, 100),
        txUpdate(prisma, email, 100),
        txUpdate(prisma, email, 100),
        txUpdate(prisma, email, 100),
        txUpdate(prisma, email, 100),
        txUpdate(prisma, email, 100),
        txUpdate(prisma, email, 100),
        txUpdate(prisma, email, 100),
        txUpdate(prisma, email, 100),
        txUpdate(prisma, email, 100),
      ])
    }
  })
})

beforeAll(async () => {
  if (!process.env.TEST_POSTGRES_URI) {
    throw new Error('TEST_POSTGRES_URI must be provided for this test')
  }

  process.env.TEST_POSTGRES_URI += '-interactive-transactions-concurrent-postgres'

  await tearDownPostgres(process.env.TEST_POSTGRES_URI)
  await migrateDb({
    connectionString: process.env.TEST_POSTGRES_URI,
    schemaPath: path.join(__dirname, 'schema.prisma'),
  })

  PrismaClient = await getTestClient()
})

beforeEach(async () => {
  prisma = new PrismaClient()

  await prisma.user.deleteMany()
})

afterEach(async () => {
  await prisma.$disconnect()
})

async function seed(prisma, email: string) {
  await prisma.user.create({
    data: {
      email: email,
      balance: 100,
    },
  })
}

function txUpdate(prisma, from, amount) {
  return prisma.$transaction(
    async (prisma) => {
      try {
        await prisma.user.update({
          data: {
            balance: {
              decrement: amount,
            },
          },
          where: {
            email: from,
          },
        })
      } catch (e) {
        console.log('transaction error which is ok for the test', e)
      }
    },
    { timeout: 25 },
  )
}
