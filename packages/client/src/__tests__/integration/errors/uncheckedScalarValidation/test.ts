import { getTestClient } from '../../../../utils/getTestClient'

test('uncheckedScalarInputs validation', async () => {
  expect.assertions(1)
  const PrismaClient = await getTestClient()
  const prisma = new PrismaClient()

  try {
    await prisma.trip.create({
      data: {
        name: 'Trip 1',
        description: 'This is a description',
        public: false,
        dateFrom: new Date('2020-12-29T10:15:16.495Z'),
        dateTo: new Date('2020-12-29T10:15:16.495Z'),
        adults: 12,
        backgroundUrl: 'https://duckduckgo.com',
        userId: 1,
        activities: {
          create: [
            {
              name: 'Activity1',
              description: 'This is activity 1',
              location: 'Some location',
              date: new Date('2020-12-29T10:15:16.495Z'),
              public: false,
              timezone: 'Europe/Berlin',
              maxPeople: 1,
              activityTypeId: 1,
              tripId: 1,
            },
          ],
        },
      },
    })
  } catch (e) {
    expect(e).toMatchInlineSnapshot(`

      Invalid \`prisma.trip.create()\` invocation in
      /client/src/__tests__/integration/errors/uncheckedScalarValidation/test.ts:0:0

        6 const prisma = new PrismaClient()
        7 
        8 try {
      → 9   await prisma.trip.create({
              data: {
                name: "Trip 1",
                description: "This is a description",
                public: false,
                dateFrom: new Date("2020-12-29T10:15:16.495Z"),
                dateTo: new Date("2020-12-29T10:15:16.495Z"),
                adults: 12,
                backgroundUrl: "https://duckduckgo.com",
                userId: 1,
                activities: {
                  create: [
                    {
                      name: "Activity1",
                      description: "This is activity 1",
                      location: "Some location",
                      date: new Date("2020-12-29T10:15:16.495Z"),
                      public: false,
                      timezone: "Europe/Berlin",
                      maxPeople: 1,
                      activityTypeId: 1,
                      tripId: 1
                    }
                  ]
                }
              }
            })

      Unknown argument \`tripId\`. Available options are marked with ?.
    `)
  }

  await prisma.$disconnect()
})
