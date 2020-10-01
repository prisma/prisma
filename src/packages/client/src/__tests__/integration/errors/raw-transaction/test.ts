import { getTestClient } from '../../../../utils/getTestClient'

test('raw-transaction: queryRaw', async () => {
  const PrismaClient = await getTestClient()
  const prisma = new PrismaClient()
  await expect(() => prisma.$transaction([prisma.$queryRaw`SELECT 1`])).rejects
    .toThrowErrorMatchingInlineSnapshot(`
          $queryRaw is not yet supported within $transaction.
          Please report in https://github.com/prisma/prisma/issues/3828 if you need this feature.
        `)

  await expect(() =>
    prisma.$transaction([
      prisma.$executeRaw`UPDATE User SET name = 'Bob' WHERE id = ''`,
    ]),
  ).rejects.toThrowErrorMatchingInlineSnapshot(`
          $executeRaw is not yet supported within $transaction.
          Please report in https://github.com/prisma/prisma/issues/3828 if you need this feature
        `)

  // unfortunately necessary
  // as $executeRaw is a promise that directly fires off, but in another async context
  setTimeout(() => {
    prisma.$disconnect()
  }, 200)
})
