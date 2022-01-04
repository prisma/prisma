import path from 'path'
import { getTestClient } from '../../../../utils/getTestClient'
import { tearDownPostgres } from '../../../../utils/setupPostgres'
import { migrateDb } from '../../__helpers__/migrateDb'

let PrismaClient, prisma

describe('interactive transaction', () => {
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
