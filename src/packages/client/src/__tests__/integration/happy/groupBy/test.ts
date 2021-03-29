import { getTestClient } from '../../../../utils/getTestClient'

let prisma

beforeAll(async () => {
  const PrismaClient = await getTestClient()
  prisma = new PrismaClient()
})

afterAll(async () => {
  await prisma.$disconnect()
})

test('groupBy email', async () => {
  const user = await prisma.user.groupBy({
    by: ['email'],
  })

  expect(user).toMatchInlineSnapshot(`
    Array [
      Object {
        email: bob+0@hey.com,
      },
      Object {
        email: bob+1@hey.com,
      },
      Object {
        email: bob+2@hey.com,
      },
      Object {
        email: bob+3@hey.com,
      },
      Object {
        email: bob+4@hey.com,
      },
      Object {
        email: bob+5@hey.com,
      },
      Object {
        email: bob+6@hey.com,
      },
      Object {
        email: bob+7@hey.com,
      },
      Object {
        email: bob+8@hey.com,
      },
      Object {
        email: bob+9@hey.com,
      },
    ]
  `)
})

test('groupBy name', async () => {
  const user = await prisma.user.groupBy({
    by: ['name'],
  })

  expect(user).toMatchInlineSnapshot(`
    Array [
      Object {
        name: Bobby Brown,
      },
    ]
  `)
})

test('groupBy 2 fields', async () => {
  const user = await prisma.user.groupBy({
    by: ['email', 'name'],
  })

  expect(user).toMatchInlineSnapshot(`
    Array [
      Object {
        email: bob+0@hey.com,
        name: Bobby Brown,
      },
      Object {
        email: bob+1@hey.com,
        name: Bobby Brown,
      },
      Object {
        email: bob+2@hey.com,
        name: Bobby Brown,
      },
      Object {
        email: bob+3@hey.com,
        name: Bobby Brown,
      },
      Object {
        email: bob+4@hey.com,
        name: Bobby Brown,
      },
      Object {
        email: bob+5@hey.com,
        name: Bobby Brown,
      },
      Object {
        email: bob+6@hey.com,
        name: Bobby Brown,
      },
      Object {
        email: bob+7@hey.com,
        name: Bobby Brown,
      },
      Object {
        email: bob+8@hey.com,
        name: Bobby Brown,
      },
      Object {
        email: bob+9@hey.com,
        name: Bobby Brown,
      },
    ]
  `)
})

// TODO: enable skip, take, age in count
// when QE bugs are fixed
test('groupBy name and aggregations', async () => {
  const user = await prisma.user.groupBy({
    by: ['name'],
    where: {
      age: {
        gt: -1,
      },
    },
    // skip: 0,
    // take: 10000,
    avg: {
      age: true,
    },
    count: {
      // age: true,
      _all: true,
    },
    max: {
      age: true,
    },
    min: {
      age: true,
    },
    sum: {
      age: true,
    },
  })

  expect(user).toMatchInlineSnapshot(`
    Array [
      Object {
        avg: Object {
          age: 80,
        },
        count: Object {
          _all: 10,
        },
        max: Object {
          age: 163,
        },
        min: Object {
          age: 5,
        },
        name: Bobby Brown,
        sum: Object {
          age: 800,
        },
      },
    ]
  `)
})

// TODO: enable skip, take, age in count
// when QE bugs are fixed
test('groupBy name and with count', async () => {
  const user = await prisma.user.groupBy({
    by: ['name'],
    count: true,
  })

  expect(user).toMatchInlineSnapshot(`
    Array [
      Object {
        count: 10,
        name: Bobby Brown,
      },
    ]
  `)
})
