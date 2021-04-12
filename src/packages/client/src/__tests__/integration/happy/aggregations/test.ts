import { getTestClient } from '../../../../utils/getTestClient'

test('aggregations', async () => {
  const PrismaClient = await getTestClient()
  const prisma = new PrismaClient()
  expect.assertions(3)
  const result = await prisma.user.aggregate({
    where: {
      age: {
        gt: -1,
      },
    },
    skip: 0,
    take: 10000,
    avg: {
      age: true,
    },
    count: true,
    max: {
      age: true,
      email: true,
    },
    min: {
      age: true,
      email: true,
    },
    sum: {
      age: true,
    },
  })

  expect(result).toMatchInlineSnapshot(`
    Object {
      avg: Object {
        age: 80,
      },
      count: 10,
      max: Object {
        age: 163,
        email: bob+9@hey.com,
      },
      min: Object {
        age: 5,
        email: bob+0@hey.com,
      },
      sum: Object {
        age: 800,
      },
    }
  `)

  const result2 = await prisma.user.aggregate({
    where: {
      age: {
        gt: -1,
      },
    },
    skip: 0,
    take: 10000,
    avg: {
      age: true,
    },
    count: {
      _all: true,
      name: true,
    },
    max: {
      age: true,
      email: true,
    },
    min: {
      age: true,
      email: true,
    },
    sum: {
      age: true,
    },
  })
  expect(result2).toMatchInlineSnapshot(`
    Object {
      avg: Object {
        age: 80,
      },
      count: Object {
        _all: 10,
        name: 10,
      },
      max: Object {
        age: 163,
        email: bob+9@hey.com,
      },
      min: Object {
        age: 5,
        email: bob+0@hey.com,
      },
      sum: Object {
        age: 800,
      },
    }
  `)

  try {
    await prisma.user.aggregate({
      where: {
        age: {
          gt: -1,
        },
      },
      skip: 0,
      take: 10000,
      avg: {
        age: true,
        email: true,
      },
    })
  } catch (err) {
    expect(err.message).toMatchInlineSnapshot(`

            Invalid \`prisma.user.aggregate()\` invocation:

            {
              where: {
                age: {
                  gt: -1
                }
              },
              skip: 0,
              take: 10000,
              avg: {
            ?   age?: true,
                email: true
                ~~~~~
              }
            }


            Unknown field \`email\` for select statement on model UserAvgAggregateOutputType. Available options are listed in green. Did you mean \`age\`?

        `)
  }

  await prisma.$disconnect()
})
