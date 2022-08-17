import { generateTestClient } from '../../../../utils/getTestClient'

test('invalid-input', async () => {
  expect.assertions(1)
  await generateTestClient()
  const { PrismaClient } = require('./node_modules/@prisma/client')
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

      Invalid \`prisma.user.create()\` invocation in
      /client/src/__tests__/integration/errors/invalid-input/test.ts:0:0

         8 await prisma.user.deleteMany()
         9 
        10 try {
      → 11   await prisma.user.create({
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
  }

  await prisma.$disconnect()
})
