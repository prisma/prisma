import { getTestClient } from '../../../../utils/getTestClient'

let prisma

beforeAll(async () => {
  const PrismaClient = await getTestClient()
  prisma = new PrismaClient()
})

afterAll(() => {
  prisma.$disconnect()
})

test('unknown property', async () => {
  expect(() => {
    prisma.muser.findMany()
  }).toThrowErrorMatchingInlineSnapshot(
    `PrismaClient - Trying to access unknown property "muser". Did you mean "user"?`,
  )
})
