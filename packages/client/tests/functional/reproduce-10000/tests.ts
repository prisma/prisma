import testMatrix from './_matrix'

/* eslint-disable @typescript-eslint/no-unused-vars */

// @ts-ignore this is just for type checks
declare let prisma: import('@prisma/client').PrismaClient

testMatrix.setupTestSuite(
  (suiteConfig, suiteMeta) => {
    describe('issue 10000', () => {
      afterAll(async () => {
        await prisma.$disconnect()
      })

      test('', async () => {
        const events = await prisma.event.create({
          data: {
            id: 'prisma',
            name: 'prisma-bug',
            sessions: {
              createMany: {
                data: [
                  { id: 'g', name: 'github' },
                  { id: 'i', name: 'issue' },
                ],
              },
            },
          },
          include: { sessions: true },
        })
        expect(events).toMatchObject({
          id: 'prisma',
          name: 'prisma-bug',
          sessions: [
            {
              eventId: 'prisma',
              id: 'g',
              name: 'github',
            },
            {
              eventId: 'prisma',
              id: 'i',
              name: 'issue',
            },
          ],
        })

        await prisma.event.delete({ where: { id: 'prisma' } })

        const sessions = await prisma.session.findMany({ orderBy: { id: 'asc' } })
        expect(sessions).toMatchObject([])
      })
    })
  },
  // Use `optOut` to opt out from testing the default selected providers
  // otherwise the suite will require all providers to be specified.
  {
    optOut: {
      from: ['sqlite', 'mongodb', 'cockroachdb', 'sqlserver', 'mysql', 'postgresql'],
      reason: 'Only testing xyz provider(s) so opting out of xxx',
    },
  },
)
