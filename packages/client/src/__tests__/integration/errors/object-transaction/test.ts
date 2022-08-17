import { generateTestClient } from '../../../../utils/getTestClient'

let PrismaClient

beforeAll(async () => {
  await generateTestClient()
  PrismaClient = require('./node_modules/@prisma/client').PrismaClient
})

test('object-transaction undefined', async () => {
  const prisma = new PrismaClient()
  await expect(async () => prisma.$transaction([await Promise.resolve()])).rejects.toThrowErrorMatchingInlineSnapshot(
    `All elements of the array need to be Prisma Client promises. Hint: Please make sure you are not awaiting the Prisma client calls you intended to pass in the $transaction function.`,
  )

  prisma.$disconnect()
})

test('object-transaction object', async () => {
  const prisma = new PrismaClient()
  await expect(async () => prisma.$transaction([await Promise.resolve({})])).rejects.toThrowErrorMatchingInlineSnapshot(
    `All elements of the array need to be Prisma Client promises. Hint: Please make sure you are not awaiting the Prisma client calls you intended to pass in the $transaction function.`,
  )

  await prisma.$disconnect()
})
