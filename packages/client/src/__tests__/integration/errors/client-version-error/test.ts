import { getQueryEngineProtocol } from '@prisma/internals'

import { getTestClient } from '../../../../utils/getTestClient'

const testIf = (condition: boolean) => (condition ? test : test.skip)
testIf(getQueryEngineProtocol() !== 'json')('client-version-error', async () => {
  const PrismaClient = await getTestClient()
  const prisma = new PrismaClient()
  try {
    await prisma.user.findMany({ invalidArg: true })
  } catch (e) {
    expect(e.clientVersion).toMatchInlineSnapshot(`client-test-version`)
    expect(e).toMatchInlineSnapshot(`

      Invalid \`prisma.user.findMany()\` invocation in
      /client/src/__tests__/integration/errors/client-version-error/test.ts:0:0

        4 const PrismaClient = await getTestClient()
        5 const prisma = new PrismaClient()
        6 try {
      → 7   await prisma.user.findMany({
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
