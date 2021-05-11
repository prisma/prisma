import { getTestClient } from '../../../../utils/getTestClient'

let prisma
describe('groupBy', () => {
  beforeAll(async () => {
    const PrismaClient = await getTestClient()
    prisma = new PrismaClient()
  })

  afterAll(async () => {
    await prisma.$disconnect()
  })

  test('email', async () => {
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

  test('name', async () => {
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

  test('2 fields', async () => {
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
        // age: true,
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

    expect(user).toMatchInlineSnapshot(`
      Array [
        Object {
          _avg: Object {
            age: 80,
          },
          _count: Object {
            _all: 10,
          },
          _max: Object {
            age: 163,
          },
          _min: Object {
            age: 5,
          },
          _sum: Object {
            age: 800,
          },
          name: Bobby Brown,
        },
      ]
    `)
  })
  test('name and aggregations (legacy)', async () => {
    try {
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
    } catch (e) {
      expect(e).toMatchInlineSnapshot(`

        Invalid \`prisma.user.groupBy()\` invocation:

        {
          by: [
            'name'
          ],
          select: {
        ?   name?: true,
            avg: {
            ~~~
              select: {
                age: true
              }
            },
            count: {
            ~~~~~
              select: {
                _all: true
              }
            },
            max: {
            ~~~
              select: {
                age: true
              }
            },
            min: {
            ~~~
              select: {
                age: true
              }
            },
            sum: {
            ~~~
              select: {
                age: true
              }
            },
        ?   id?: true,
        ?   email?: true,
        ?   age?: true,
        ?   _count?: true,
        ?   _avg?: true,
        ?   _sum?: true,
        ?   _min?: true,
        ?   _max?: true
          },
          where: {
            age: {
              gt: -1
            }
          }
        }


        Unknown field \`avg\` for select statement on model UserGroupByOutputType. Available options are listed in green. Did you mean \`_avg\`?
        Unknown field \`count\` for select statement on model UserGroupByOutputType. Available options are listed in green. Did you mean \`_count\`?
        Unknown field \`max\` for select statement on model UserGroupByOutputType. Available options are listed in green. Did you mean \`_max\`?
        Unknown field \`min\` for select statement on model UserGroupByOutputType. Available options are listed in green. Did you mean \`_min\`?
        Unknown field \`sum\` for select statement on model UserGroupByOutputType. Available options are listed in green. Did you mean \`_sum\`?

      `)
    }
  })
  // TODO: enable skip, take, age in count
  // when QE bugs are fixed
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
  test('name and with count (legacy)', async () => {
    try {
      const user = await prisma.user.groupBy({
        by: ['name'],
        count: true,
      })
    } catch (e) {
      expect(e).toMatchInlineSnapshot(`

        Invalid \`prisma.user.groupBy()\` invocation:

        {
          by: [
            'name'
          ],
          select: {
        ?   name?: true,
            count: {
            ~~~~~
              select: true
            },
        ?   id?: true,
        ?   email?: true,
        ?   age?: true,
        ?   _count?: true,
        ?   _avg?: true,
        ?   _sum?: true,
        ?   _min?: true,
        ?   _max?: true
          }
        }


        Unknown field \`count\` for select statement on model UserGroupByOutputType. Available options are listed in green. Did you mean \`_count\`?

      `)
    }
  })
})
