import { getTestClient } from '../../../../utils/getTestClient'

test('count', async () => {
  const PrismaClient = await getTestClient()
  const prisma = new PrismaClient()
  const result = await prisma.user.count()
  expect.assertions(4)
  expect(result).toMatchInlineSnapshot(`10`)

  const result2 = await prisma.user.count({
    select: true,
  })
  expect(result2).toMatchInlineSnapshot(`10`)

  const result3 = await prisma.user.count({
    select: {
      _all: true,
      email: true,
      age: true,
      name: true,
    },
  })
  expect(result3).toMatchInlineSnapshot(`
    Object {
      _all: 10,
      age: 10,
      email: 10,
      name: 10,
    }
  `)
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

      Invalid \`prisma.user.aggregate()\` invocation:

      {
        _count: {
      ?   _all?: true,
      ?   email?: true,
      ?   age?: true,
      ?   name?: true,
          posts: true,
          ~~~~~
      ?   id?: true
        }
      }


      Unknown field \`posts\` for select statement on model UserCountAggregateOutputType. Available options are listed in green. Did you mean \`id\`?

    `)
  }
  await prisma.$disconnect()
})
