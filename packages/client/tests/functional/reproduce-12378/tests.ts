import testMatrix from './_matrix'

/* eslint-disable @typescript-eslint/no-unused-vars */

// @ts-ignore this is just for type checks
declare let prisma: import('@prisma/client').PrismaClient

testMatrix.setupTestSuite(
  (suiteConfig, suiteMeta) => {
    describe('issue 12378', () => {
      afterAll(async () => {
        await prisma.$disconnect()
      })

      test('issue 12378', async () => {
        const user = await prisma.user.create({
          data: {
            email: 'user@example.com',
            name: 'Max',
          },
        })
        expect(user).toMatchObject({
          email: 'user@example.com',
          name: 'Max',
        })
        expect(user.id).toBeTruthy()

        const workspace = await prisma.workspace.create({
          data: {
            name: 'workspace',
            users: {
              create: [
                {
                  user: {
                    connect: {
                      id: user.id,
                    },
                  },
                },
              ],
            },
          },
        })
        expect(workspace).toMatchObject({
          name: 'workspace',
        })
        expect(workspace.id).toBeTruthy()

        const userAsBob = await prisma.user.update({
          where: { id: user.id },
          data: {
            name: 'Bob',
          },
        })
        expect(userAsBob).toMatchObject({
          email: 'user@example.com',
          name: 'Bob',
        })
        expect(userAsBob.id).toBeTruthy()
        expect(user.id).toMatch(userAsBob.id)
      })
    })
  },
  // Use `optOut` to opt out from testing the default selected providers
  // otherwise the suite will require all providers to be specified.
  {
    optOut: {
      from: ['sqlite', 'mongodb'],
      reason: 'Only testing PostgreSQL, MySQL, SQL Server and CockroachDB',
    },
  },
)
