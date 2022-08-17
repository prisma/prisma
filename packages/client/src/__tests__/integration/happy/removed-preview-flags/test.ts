import { generateTestClient } from '../../../../utils/getTestClient'

test('removed-preview-flags', async () => {
  console.log = () => null
  await generateTestClient()
  const PrismaClient = require('./node_modules/@prisma/client').PrismaClient
  const prisma = new PrismaClient()

  const result = await prisma.user.aggregate({
    where: {
      age: {
        gt: -1,
      },
    },
    skip: 0,
    take: 10000,
    _avg: {
      age: true,
    },
    _count: true,
    _max: {
      age: true,
    },
    _min: {
      age: true,
    },
    _sum: {
      age: true,
    },
  })

  expect(result).toEqual({
    _count: 10,
    _avg: { age: 80 },
    _max: { age: 163 },
    _min: { age: 5 },
    _sum: { age: 800 },
  })

  await prisma.$disconnect()
})
