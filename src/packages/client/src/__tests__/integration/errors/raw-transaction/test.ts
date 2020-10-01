import { getTestClient } from '../../../../utils/getTestClient'

let prisma

beforeAll(async () => {
  const PrismaClient = await getTestClient()
  prisma = new PrismaClient()
})

afterAll(() => {
  setTimeout(() => {
    prisma.$disconnect()
  }, 500)
})

test('raw-transaction: queryRaw', async () => {
  await expect(() => prisma.$transaction([prisma.$queryRaw`SELECT 1`])).rejects
    .toThrowErrorMatchingInlineSnapshot(`
          $queryRaw is not yet supported within $transaction.
          Please report in https://github.com/prisma/prisma/issues/3828 if you need this feature.
        `)

  await expect(async () =>
    prisma.$transaction([
      prisma.$executeRaw`UPDATE User SET name = 'Bob' WHERE id = ''`,
    ]),
  ).rejects.toThrowErrorMatchingInlineSnapshot(`
          $executeRaw is not yet supported within $transaction.
          Please report in https://github.com/prisma/prisma/issues/3828 if you need this feature
        `)
})
