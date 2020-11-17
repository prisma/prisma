import { getTestClient } from '../../../../utils/getTestClient'

test('invalid-input', async () => {
  expect.assertions(1)
  const PrismaClient = await getTestClient()
  const prisma = new PrismaClient()
  await prisma.user.deleteMany()

  try {
    await prisma.user.create({
      data: {
        email: 'a@a.de',
        posts: {
          connect: { id: [] },
        },
      },
    })
  } catch (e) {
    expect(e).toMatchInlineSnapshot(`

      Invalid \`prisma.user.create()\` invocation:

      {
        data: {
          email: 'a@a.de',
          posts: {
            connect: {
              id: []
              ~~
            }
          }
        }
      }

      Argument id: Got invalid value [] on prisma.createOneUser. Provided List<>, expected String.


    `)
  }

  await prisma.$disconnect()
})
