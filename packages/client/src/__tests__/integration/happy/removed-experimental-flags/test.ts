import { getTestClient } from '../../../../utils/getTestClient'

test('removed-experimental-flags', async () => {
  console.log = () => null
  const PrismaClient = await getTestClient()
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
