import { generateTestClient } from '../../../../utils/getTestClient'

test('union validation', async () => {
  expect.assertions(1)
  await generateTestClient()
  const PrismaClient = require('./node_modules/@prisma/client').PrismaClient
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

         7 const prisma = new PrismaClient()
         8 
         9 try {
      → 10   await prisma.organization.create({
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
