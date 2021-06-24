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
    // TODO The error output should be identical for both Node-API libary and binary: https://github.com/prisma/prisma/issues/7811
    if (process.env.PRISMA_FORCE_NAPI) {
      expect(e).toMatchInlineSnapshot(`

        Invalid \`prisma.user.create()\` invocation in
        /client/src/__tests__/integration/errors/invalid-input/test.ts:10:23

           7 await prisma.user.deleteMany()
           8 
           9 try {
        → 10   await prisma.user.create({
                 data: {
                   email: 'a@a.de',
                   posts: {
                     connect: {
                       id: []
                       ~~
                     }
                   }
                 }
               })

        Argument id: Got invalid value [] on prisma.createOneUser. Provided List<>, expected String.


      `)
    } else {
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
  }

  await prisma.$disconnect()
})
