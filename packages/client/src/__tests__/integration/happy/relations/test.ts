import { generateTestClient } from '../../../../utils/getTestClient'

test('relations', async () => {
  await generateTestClient()
  const PrismaClient = require('./node_modules/@prisma/client').PrismaClient
  const db = new PrismaClient()
  const prisma = new PrismaClient()

  const result = await prisma.sale.findMany({
    where: {
      persons: {
        some: {
          name: {
            contains: 'smith',
          },
        },
      },
    },
  })

  expect(result).toEqual([])

  const resultWhereNull = await prisma.sale.findMany({
    where: {
      persons: {
        some: {
          canBeNull: null,
        },
      },
    },
  })

  expect(resultWhereNull).toEqual([])

  const resultWhereORDateNotNull = await prisma.sale.findMany({
    where: {
      OR: [
        {
          dateOptional: {
            not: null,
          },
        },
      ],
    },
  })

  expect(resultWhereORDateNotNull).toEqual([])

  await db.$disconnect()
  await prisma.$disconnect()
})
