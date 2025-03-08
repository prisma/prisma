import path from 'node:path'

import { getTestClient } from '../../../../utils/getTestClient'
import { tearDownPostgres } from '../../../../utils/setupPostgres'
import { migrateDb } from '../../__helpers__/migrateDb'

beforeAll(async () => {
  process.env.DATABASE_URL = process.env.TEST_POSTGRES_URI!.replace('tests', 'tests-json-postgres')
  await tearDownPostgres(process.env.DATABASE_URL)
  await migrateDb({
    schemaPath: path.join(__dirname, 'schema.prisma'),
  })
})

test('postgres-json-list', async () => {
  const PrismaClient = await getTestClient()

  const prisma = new PrismaClient()

  await prisma.user.deleteMany()

  let data = {
    jsonList: [{ hello: 'world' }],
  }

  let user = await prisma.user.create({
    data,
    select: {
      jsonList: true,
    },
  })

  expect(data).toEqual(user)

  data = {
    jsonList: [],
  }

  user = await prisma.user.create({
    data,
    select: {
      jsonList: true,
    },
  })

  expect(data).toEqual(user)

  await prisma.$disconnect()
})
