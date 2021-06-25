import { getTestClient } from '../../../../utils/getTestClient'

test('multiple-errors-one-client', async () => {
  const PrismaClient = await getTestClient()
  const prisma = new PrismaClient()

  try {
    await prisma.user.findMany({ invalidArg: true })
  } catch (e) {
    console.log(e)
    expect(e).toMatchInlineSnapshot(`

      Invalid \`prisma.user.findMany()\` invocation in
      /client/src/__tests__/integration/errors/multiple-errors-one-client/test.ts:8:23

         5 const prisma = new PrismaClient()
         6 
         7 try {
      →  8   await prisma.user.findMany({
               invalidArg: true
               ~~~~~~~~~~
             })

      Unknown arg \`invalidArg\` in invalidArg for type User. Did you mean \`where\`? Available args:
      type findManyUser {
        where?: UserWhereInput
        orderBy?: List<UserOrderByInput> | UserOrderByInput
        cursor?: UserWhereUniqueInput
        take?: Int
        skip?: Int
        distinct?: List<UserScalarFieldEnum>
      }


    `)
  }

  try {
    await prisma.user.findMany({ invalidArg: true })
  } catch (e) {
    console.log(e)
    expect(e).toMatchInlineSnapshot(`

      Invalid \`prisma.user.findMany()\` invocation in
      /client/src/__tests__/integration/errors/multiple-errors-one-client/test.ts:39:23

        36 }
        37 
        38 try {
      → 39   await prisma.user.findMany({
               invalidArg: true
               ~~~~~~~~~~
             })

      Unknown arg \`invalidArg\` in invalidArg for type User. Did you mean \`where\`? Available args:
      type findManyUser {
        where?: UserWhereInput
        orderBy?: List<UserOrderByInput> | UserOrderByInput
        cursor?: UserWhereUniqueInput
        take?: Int
        skip?: Int
        distinct?: List<UserScalarFieldEnum>
      }


    `)
  }

  await prisma.$disconnect()
})
