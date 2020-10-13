import { getTestClient } from '../../../../utils/getTestClient'
import path from 'path'
import { migrateDb } from '../../__helpers__/migrateDb'

beforeAll(async () => {
  process.env.TEST_MYSQL_URI += '-mysql-string-escape'
  await migrateDb({
    connectionString: process.env.TEST_MYSQL_URI!,
    schemaPath: path.join(__dirname, 'schema.prisma'),
  })
})

test('mysql string escape', async () => {
  const PrismaClient = await getTestClient()

  const prisma = new PrismaClient()

  const result = await prisma.queryRaw`SELECT * FROM User WHERE name = ${`"name"`}`

  prisma.$disconnect()

  expect(1).toBe(1)
})
