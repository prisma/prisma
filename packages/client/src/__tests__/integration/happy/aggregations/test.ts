import { getTestClient } from '../../../../utils/getTestClient'

describe('aggregations', () => {
  test('general', async () => {
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
      _avg: {
        age: true,
      },
      _count: true,
      _max: {
        age: true,
        email: true,
      },
      _min: {
        age: true,
        email: true,
      },
      _sum: {
        age: true,
      },
    })

    expect(result).toMatchInlineSnapshot(`
      Object {
        _avg: Object {
          age: 80,
        },
        _count: 10,
        _max: Object {
          age: 163,
          email: bob+9@hey.com,
        },
        _min: Object {
          age: 5,
          email: bob+0@hey.com,
        },
        _sum: Object {
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
      _avg: {
        age: true,
      },
      _count: {
        _all: true,
        name: true,
      },
      _max: {
        age: true,
        email: true,
      },
      _min: {
        age: true,
        email: true,
      },
      _sum: {
        age: true,
      },
    })
    expect(result2).toMatchInlineSnapshot(`
      Object {
        _avg: Object {
          age: 80,
        },
        _count: Object {
          _all: 10,
          name: 10,
        },
        _max: Object {
          age: 163,
          email: bob+9@hey.com,
        },
        _min: Object {
          age: 5,
          email: bob+0@hey.com,
        },
        _sum: Object {
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
        _avg: {
          age: true,
          email: true,
        },
      })
    } catch (err) {
      expect(err.message).toMatchInlineSnapshot(`

        Invalid \`prisma.user.aggregate()\` invocation:

        {
          _avg: {
        ?   age?: true,
            email: true
            ~~~~~
          },
          where: {
            age: {
              gt: -1
            }
          },
          skip: 0,
          take: 10000
        }


        Unknown field \`email\` for select statement on model UserAvgAggregateOutputType. Available options are listed in green. Did you mean \`age\`?

      `)
    }

    await prisma.$disconnect()
  })
})
