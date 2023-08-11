import { getTestClient } from '../../../../utils/getTestClient'

let prisma

beforeAll(async () => {
  const PrismaClient = await getTestClient()
  prisma = new PrismaClient()
})

afterAll(async () => {
  await prisma.$disconnect()
})

test('raw-transaction: queryRaw', async () => {
  let result = await prisma.$transaction([prisma.$queryRaw`SELECT 1`])

  expect(result).toMatchInlineSnapshot(`
    [
      [
        {
          1: 1n,
        },
      ],
    ]
  `)

  const executePromise = prisma.$executeRaw`UPDATE User SET name = 'Bob' WHERE id = ''`
  result = await prisma.$transaction([executePromise])

  expect(result).toMatchInlineSnapshot(`
    [
      0,
    ]
  `)
})
