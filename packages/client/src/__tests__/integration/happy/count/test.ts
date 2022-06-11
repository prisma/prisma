import { getTestClient } from '../../../../utils/getTestClient'

let PrismaClient, prisma

describe('count', () => {
  beforeAll(async () => {
    PrismaClient = await getTestClient()
  })

  beforeEach(() => {
    prisma = new PrismaClient()
  })

  afterEach(async () => {
    await prisma.$disconnect()
  })

  test('simple', async () => {
    const value = await prisma.user.count()

    expect(value).toMatchInlineSnapshot(`10`)
  })

  test('where', async () => {
    const value = await prisma.user.count({
      where: {
        age: 84,
      },
    })

    expect(value).toMatchInlineSnapshot(`1`)
  })

  test('select where', async () => {
    const value = await prisma.user.count({
      select: true,
      where: {
        age: 84,
      },
    })

    expect(value).toMatchInlineSnapshot(`1`)
  })

  test('select mixed where', async () => {
    const value = await prisma.user.count({
      select: {
        _all: true,
        email: true,
        age: true,
        name: true,
      },
      where: {
        age: 84,
      },
    })

    expect(value).toMatchInlineSnapshot(`
      Object {
        _all: 1,
        age: 1,
        email: 1,
        name: 1,
      }
    `)
  })

  test('select all true', async () => {
    const value = await prisma.user.count({
      select: true, // count with a selection
    })

    expect(value).toMatchInlineSnapshot(`10`)
  })

  test('select all false', async () => {
    const value = await prisma.user.count({
      select: false, // count with no selection
    })

    expect(value).toMatchInlineSnapshot(`10`)
  })

  test('select mixed', async () => {
    const value = await prisma.user.count({
      select: {
        _all: true,
        email: true,
        age: true,
        name: true,
      },
    })

    expect(value).toMatchInlineSnapshot(`
      Object {
        _all: 10,
        age: 10,
        email: 10,
        name: 10,
      }
    `)
  })

  test('bad prop', async () => {
    try {
      await prisma.user.count({
        select: {
          _all: true,
          email: true,
          age: true,
          name: true,
          posts: true,
        },
      })
    } catch (err) {
      expect(err.message).toMatchInlineSnapshot(`

                      Invalid \`prisma.user.count()\` invocation:

                      {
                        select: {
                          _count: {
                            select: {
                      ?       _all?: true,
                      ?       email?: true,
                      ?       age?: true,
                      ?       name?: true,
                              posts: true,
                              ~~~~~
                      ?       id?: true
                            }
                          }
                        }
                      }


                      Unknown field \`posts\` for select statement on model UserCountAggregateOutputType. Available options are listed in green. Did you mean \`id\`?

                  `)
    }
  })
})
