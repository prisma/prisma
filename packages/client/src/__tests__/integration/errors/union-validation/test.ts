import { getQueryEngineProtocol } from '@prisma/internals'

import { getTestClient } from '../../../../utils/getTestClient'

const testIf = (condition: boolean) => (condition ? test : test.skip)

testIf(getQueryEngineProtocol() !== 'json')('union validation', async () => {
  expect.assertions(1)
  const PrismaClient = await getTestClient()
  const prisma = new PrismaClient()

  try {
    await prisma.organization.create({
      data: {
        fullName: 'name',
        accounts: {
          create: {
            operator: {
              create: {
                prefix: 'prefix',
              },
            },
          },
        },
      },
    })
  } catch (e) {
    expect(e).toMatchInlineSnapshot(`

      Invalid \`prisma.organization.create()\` invocation in
      /client/src/__tests__/integration/errors/union-validation/test.ts:0:0

        10 const prisma = new PrismaClient()
        11 
        12 try {
      → 13   await prisma.organization.create({
               data: {
                 fullName: 'name',
                 accounts: {
                   create: {
                     operator: {
                       create: {
                         prefix: 'prefix',
             +           organization: {
             +             create?: OrganizationCreateWithoutOperatorInput | OrganizationUncheckedCreateWithoutOperatorInput,
             +             connectOrCreate?: OrganizationCreateOrConnectWithoutOperatorInput,
             +             connect?: OrganizationWhereUniqueInput
             +           },
             ?           id?: String
                       }
                     }
                   }
                 }
               }
             })

      Argument organization for data.accounts.create.operator.create.organization is missing.

      Note: Lines with + are required, lines with ? are optional.

    `)
  }

  await prisma.$disconnect()
})
