import testMatrix from './_matrix'

// @ts-ignore this is just for type checks
declare let prisma: import('@prisma/client').PrismaClient

testMatrix.setupTestSuite(
  () => {
    // an example of how to query with the preloaded client
    test('test', async () => {
      try {
        await prisma.user.delete({
          where: {
            email: 'notfound',
          },
        })
      } catch (error) {
        expect(error.message).toMatchInlineSnapshot(`

          Invalid \`prisma.user.delete()\` invocation in
          /client/tests/functional/replication/tests.ts:11:33

             8 // an example of how to query with the preloaded client
             9 test('test', async () => {
            10   try {
          → 11     await prisma.user.delete({
                     where: {
                       email: 'notfound'
                       ~~~~~
                     }
                   })

          Unknown arg \`email\` in where.email for type UserWhereUniqueInput. Did you mean \`id\`? Available args:
          type UserWhereUniqueInput {
            id?: String
          }


        `)
      }
    })
  },
  {
    optOut: {
      from: ['postgresql', 'mysql', 'sqlserver', 'cockroachdb', 'mongodb'],
      reason: 'TEST',
    },
  },
)
