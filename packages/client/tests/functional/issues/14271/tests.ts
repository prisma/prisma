import testMatrix from './_matrix'

/* eslint-disable @typescript-eslint/no-unused-vars */

// @ts-ignore this is just for type checks
declare let prisma: import('@prisma/client').PrismaClient

// TODO: maybe we can split each relation into a separate file for readability
testMatrix.setupTestSuite(
  (suiteConfig, suiteMeta) => {
    describe('issue 14271', () => {
      afterAll(async () => {
        await prisma.$disconnect()
      })

      test('issue 14271', async () => {
        await prisma['hub'].create({
          data: {
            name: 'hub-1',
            batteryLevels: {
              createMany: {
                data: [
                  {
                    name: 'battery-1-hub-1',
                  },
                  {
                    name: 'battery-2-hub-1',
                  },
                ],
              },
            },
          },
        })
        await prisma['hub'].create({
          data: {
            name: 'hub-2',
            batteryLevels: {
              createMany: {
                data: [
                  {
                    name: 'battery-1-hub-2',
                  },
                  {
                    name: 'battery-2-hub-2',
                  },
                ],
              },
            },
          },
        })

        expect(await prisma['hub'].findMany({ orderBy: { id: 'asc' } })).toMatchInlineSnapshot(`
          [
            {
              id: 1,
              name: hub-1,
            },
            {
              id: 2,
              name: hub-2,
            },
          ]
        `)

        expect(await prisma['batteryLevel'].findMany({ orderBy: { id: 'asc' } })).toMatchInlineSnapshot(`
          [
            {
              hubId: 1,
              id: 1,
              name: battery-1-hub-1,
            },
            {
              hubId: 1,
              id: 2,
              name: battery-2-hub-1,
            },
            {
              hubId: 2,
              id: 3,
              name: battery-1-hub-2,
            },
            {
              hubId: 2,
              id: 4,
              name: battery-2-hub-2,
            },
          ]
        `)

        await prisma['hub'].delete({
          where: { name: 'hub-1' },
        })

        expect(await prisma['hub'].findMany({})).toMatchInlineSnapshot(`
          [
            {
              id: 2,
              name: hub-2,
            },
          ]
        `)

        expect(await prisma['batteryLevel'].findMany({ orderBy: { id: 'asc' } })).toMatchInlineSnapshot(`
          [
            {
              hubId: null,
              id: 1,
              name: battery-1-hub-1,
            },
            {
              hubId: null,
              id: 2,
              name: battery-2-hub-1,
            },
            {
              hubId: 2,
              id: 3,
              name: battery-1-hub-2,
            },
            {
              hubId: 2,
              id: 4,
              name: battery-2-hub-2,
            },
          ]
        `)
      })
    })
  },
  // Use `optOut` to opt out from testing the default selected providers
  // otherwise the suite will require all providers to be specified.
  {
    optOut: {
      from: ['sqlite', 'mongodb', 'cockroachdb', 'sqlserver', 'mysql', 'postgresql'],
      reason: 'Only testing postgresql',
    },
  },
)
