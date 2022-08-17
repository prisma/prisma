import { generateTestClient } from '../../../../utils/getTestClient'

let prisma
describe('groupBy', () => {
  beforeAll(async () => {
    await generateTestClient()
    const PrismaClient = require('./node_modules/@prisma/client').PrismaClient
    prisma = new PrismaClient()
  })

  afterAll(async () => {
    await prisma.$disconnect()
  })

  test('email', async () => {
    const user = await prisma.user.groupBy({
      by: ['email'],
    })

    expect(user).toMatchSnapshot()
  })

  test('name', async () => {
    const user = await prisma.user.groupBy({
      by: ['name'],
    })
    expect(user).toMatchSnapshot()
  })

  test('2 fields', async () => {
    const user = await prisma.user.groupBy({
      by: ['email', 'name'],
    })

    expect(user).toMatchSnapshot()
  })

  test('count field and aggregations', async () => {
    const user = await prisma.user.groupBy({
      by: ['count'],
      where: {
        age: {
          gt: -1,
        },
      },
      _count: true,
      _min: {
        min: true,
      },
    })
    expect(user).toMatchSnapshot()
  })
  test('by  [name, count, min, sum, max, avg] with aggregations', async () => {
    // This is a regression test for this issue https://github.com/prisma/prisma/issues/7052
    const user = await prisma.user.groupBy({
      by: ['name', 'count', 'min', 'sum', 'max', 'avg'],
      where: {
        age: {
          gt: -1,
        },
      },
      _count: true,
      _min: {
        min: true,
      },
    })
    expect(user).toMatchSnapshot()
  })
  // TODO: enable skip, take, age in count
  // when QE bugs are fixed
  test('name and aggregations', async () => {
    const user = await prisma.user.groupBy({
      by: ['name'],
      where: {
        age: {
          gt: -1,
        },
      },
      // skip: 0,
      // take: 10000,
      _avg: {
        age: true,
      },
      _count: {
        age: true,
        _all: true,
      },
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

    expect(user).toMatchSnapshot()
  })

  test('name and with count', async () => {
    const user = await prisma.user.groupBy({
      by: ['name'],
      _count: true,
    })

    expect(user).toMatchInlineSnapshot(`
      Array [
        Object {
          _count: 10,
          name: Bobby Brown,
        },
      ]
    `)
  })
})
