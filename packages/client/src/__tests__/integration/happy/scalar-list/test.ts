import path from 'path'

import { generateTestClient } from '../../../../utils/getTestClient'
import { tearDownPostgres } from '../../../../utils/setupPostgres'
import { migrateDb } from '../../__helpers__/migrateDb'

let PrismaClient

beforeAll(async () => {
  process.env.TEST_POSTGRES_URI += '-scalar-list-test'
  await tearDownPostgres(process.env.TEST_POSTGRES_URI!)
  await migrateDb({
    connectionString: process.env.TEST_POSTGRES_URI!,
    schemaPath: path.join(__dirname, 'schema.prisma'),
  })
  await generateTestClient()
  PrismaClient = require('./node_modules/@prisma/client').PrismaClient
})

async function setupData(prisma) {
  await prisma.forest.deleteMany()
  await prisma.forest.create({
    data: {
      trees: ['Oak', 'Pine', 'Ash'],
      names: ['Some', 'Random', 'Names'],
      randomInts: [1, 2, 3, 4, 5],
      randomFloats: [1.1, 1.2, 1.3],
      jsonList: [{ json: 1 }, { json: 2 }],
    },
  })
  await prisma.forest.create({
    data: {
      trees: ['Oak', 'Pine'],
      names: ['Some', 'Names'],
      randomInts: [1, 2, 5],
      randomFloats: [1.1, 1.3],
      jsonList: [{ json: 1 }, { json: 2 }, { json: 3 }],
    },
  })
}

test('scalar-list filter', async () => {
  const prisma = new PrismaClient()
  // 1. set up data
  await setupData(prisma)

  // 2. do some queries
  let result = await prisma.forest.findMany({
    where: {
      trees: {
        isEmpty: false,
      },
    },
  })
  expect(result.length).toBe(2)

  result = await prisma.forest.findMany({
    where: {
      trees: {
        has: 'Oak',
      },
    },
  })
  expect(result.length).toBe(2)

  result = await prisma.forest.findMany({
    where: {
      trees: {
        hasEvery: ['Oak', 'Pine'],
      },
    },
  })
  expect(result.length).toBe(2)

  result = await prisma.forest.findMany({
    where: {
      trees: {
        hasSome: ['Ash'],
      },
    },
  })
  expect(result.length).toBe(1)

  result = await prisma.forest.findMany({
    where: {
      randomInts: {
        isEmpty: false,
      },
    },
  })
  expect(result.length).toBe(2)

  result = await prisma.forest.findMany({
    where: {
      randomInts: {
        hasSome: [1, 2, 5],
      },
    },
  })
  expect(result.length).toBe(2)

  result = await prisma.forest.findMany({
    where: {
      randomInts: {
        hasEvery: [1, 2, 3, 5],
      },
    },
  })
  expect(result.length).toBe(1)

  await prisma.$disconnect()
})
