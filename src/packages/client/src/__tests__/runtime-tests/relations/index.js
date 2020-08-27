const { PrismaClient } = require('@prisma/client')
const assert = require('assert')

module.exports = async () => {
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

  assert.deepStrictEqual(result, [])

  const resultWhereNull = await prisma.sale.findMany({
    where: {
      persons: {
        some: {
          canBeNull: null,
        },
      },
    },
  })

  assert.deepStrictEqual(resultWhereNull, [])

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

  assert.deepStrictEqual(resultWhereORDateNotNull, [])

  const resultWhereNullSingularRelationField = await prisma.location.findMany({
    where: {
      company: null,
    },
  })

  assert.deepStrictEqual(resultWhereNullSingularRelationField, [])

  await db.$disconnect()
}

if (require.main === module) {
  module.exports()
}
