import { getTestClient } from '../../../../utils/getTestClient'

let prisma

beforeAll(async () => {
  const PrismaClient = await getTestClient()
  prisma = new PrismaClient()
})

afterAll(async () => {
  await prisma.$disconnect()
})

test('findMany filter by rfc3339 date string', async () => {
  const user = await prisma.post.findMany({
    where: {
      createdAt: {
        gt: '2019-01-13T12:40:47+01:00',
      },
    },
  })

  expect(user).toMatchInlineSnapshot(`Array []`)
})
