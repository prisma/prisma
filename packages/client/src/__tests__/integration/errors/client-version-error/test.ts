import { generateTestClient } from '../../../../utils/getTestClient'

test('client-version-error', async () => {
  await generateTestClient()
  const { PrismaClient } = require('./node_modules/@prisma/client')
  const prisma = new PrismaClient()
  try {
    await prisma.user.findMany({ invalidArg: true })
  } catch (e) {
    expect(e.clientVersion).toMatchInlineSnapshot(`local`)
    expect(e).toMatchInlineSnapshot(`

      Invalid \`prisma.user.findMany()\` invocation in
      /client/src/__tests__/integration/errors/client-version-error/test.ts:0:0

         5 const { PrismaClient } = require('./node_modules/@prisma/client')
         6 const prisma = new PrismaClient()
         7 try {
      →  8   await prisma.user.findMany({
               invalidArg: true
               ~~~~~~~~~~
             })

      Unknown arg \`invalidArg\` in invalidArg for type User. Did you mean \`where\`? Available args:
      type findManyUser {
        where?: UserWhereInput
        orderBy?: List<UserOrderByWithRelationInput> | UserOrderByWithRelationInput
        cursor?: UserWhereUniqueInput
        take?: Int
        skip?: Int
        distinct?: List<UserScalarFieldEnum>
      }


    `)
    await prisma.$disconnect()
  }
})
