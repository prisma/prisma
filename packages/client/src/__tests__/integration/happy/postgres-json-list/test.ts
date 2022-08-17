import path from 'path'

import { generateTestClient } from '../../../../utils/getTestClient'
import { tearDownPostgres } from '../../../../utils/setupPostgres'
import { migrateDb } from '../../__helpers__/migrateDb'

beforeAll(async () => {
  process.env.TEST_POSTGRES_URI += '-json-postgres'
  await tearDownPostgres(process.env.TEST_POSTGRES_URI!)
  await migrateDb({
    connectionString: process.env.TEST_POSTGRES_URI!,
    schemaPath: path.join(__dirname, 'schema.prisma'),
  })
})

test('postgres-json-list', async () => {
  await generateTestClient()
  const PrismaClient = require('./node_modules/@prisma/client').PrismaClient

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
