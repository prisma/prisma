import { getTestClient } from '../../../../utils/getTestClient'

let prisma

beforeAll(async () => {
  const PrismaClient = await getTestClient()
  prisma = new PrismaClient()
})

afterAll(() => {
  prisma.$disconnect()
})

test('orderBy relation', async () => {
  const users = await prisma.post.findMany({
    orderBy: {
      author: {
        email: 'asc',
      },
    },
    include: { author: true },
  })
  expect(users).toMatchInlineSnapshot(`
    Array [
      Object {
        author: Object {
          age: 1,
          email: 1@prisma.com,
          id: 607e7d2d-70ae-4926-be52-c1d378bb12b3,
          name: null,
        },
        authorId: 607e7d2d-70ae-4926-be52-c1d378bb12b3,
        content: null,
        createdAt: 2021-02-01T00:00:00.000Z,
        id: ckkmoa37o0000j5d5glrwfqtg,
        published: false,
        title: D,
        updatedAt: 2021-02-01T00:00:00.000Z,
      },
      Object {
        author: Object {
          age: 2,
          email: 2@prisma.com,
          id: b319b9bf-c5b8-44ae-934a-f4b2c76bfc1b,
          name: null,
        },
        authorId: b319b9bf-c5b8-44ae-934a-f4b2c76bfc1b,
        content: null,
        createdAt: 2021-02-01T00:00:00.000Z,
        id: ckkmoamte0000rtd513viatbt,
        published: false,
        title: A,
        updatedAt: 2021-02-01T00:00:00.000Z,
      },
      Object {
        author: Object {
          age: 3,
          email: 3@prisma.com,
          id: cbafc0ac-2d6b-4ef3-bfaf-0102276f938f,
          name: null,
        },
        authorId: cbafc0ac-2d6b-4ef3-bfaf-0102276f938f,
        content: null,
        createdAt: 2021-02-01T00:00:00.000Z,
        id: ckkmob0fk00000yd5515t120i,
        published: false,
        title: B,
        updatedAt: 2021-02-01T00:00:00.000Z,
      },
      Object {
        author: Object {
          age: 4,
          email: 4@prisma.com,
          id: 2dcc5637-dd89-4d3f-89ab-198cfcda3aae,
          name: null,
        },
        authorId: 2dcc5637-dd89-4d3f-89ab-198cfcda3aae,
        content: null,
        createdAt: 2021-02-01T00:00:00.000Z,
        id: ckkmobew800009bd5v7n82jhc,
        published: false,
        title: C,
        updatedAt: 2021-02-01T00:00:00.000Z,
      },
    ]
  `)
  const reverse = await prisma.post.findMany({
    orderBy: {
      author: {
        email: 'desc',
      },
    },
    include: { author: true },
  })
  expect(reverse).toEqual(users.reverse())
})
