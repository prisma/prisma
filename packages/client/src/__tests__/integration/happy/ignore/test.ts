import { getTestClient } from '../../../../utils/getTestClient'

let prisma

// beforeAll(async () => {
//   const PrismaClient = await getTestClient()
//   prisma = new PrismaClient()
// })

// afterAll(async () => {
//   await prisma.$disconnect()
// })

test.skip('findMany with ignore', async () => {
  const user = await prisma.user.findMany()

  expect(user).toMatchInlineSnapshot(`
    [
      {
        age: 93,
        email: bob+0@hey.com,
        id: 234cba9a-5cd9-4e00-a285-9955eb3bdf8f,
        name: Bobby Brown,
      },
      {
        age: 14,
        email: bob+1@hey.com,
        id: 9d9b7fd0-bfce-4017-945c-0ffaee1eb5f0,
        name: Bobby Brown,
      },
      {
        age: 84,
        email: bob+2@hey.com,
        id: ad291441-9ce9-4e9f-9cbb-9fcfe15ea519,
        name: Bobby Brown,
      },
      {
        age: 137,
        email: bob+3@hey.com,
        id: d36a2dfe-d8fd-488d-973c-bb1b1b082014,
        name: Bobby Brown,
      },
      {
        age: 67,
        email: bob+4@hey.com,
        id: e7b2f865-59a0-4303-aa82-c7f9c1f86806,
        name: Bobby Brown,
      },
      {
        age: 163,
        email: bob+5@hey.com,
        id: 13b817ae-401c-40a8-8609-0da43f462d2e,
        name: Bobby Brown,
      },
      {
        age: 49,
        email: bob+6@hey.com,
        id: 4240fe9d-e363-484d-ae21-3ed7dc5a17fd,
        name: Bobby Brown,
      },
      {
        age: 67,
        email: bob+7@hey.com,
        id: 48ad17bb-ed9b-4590-a782-30a4f2cfab4e,
        name: Bobby Brown,
      },
      {
        age: 121,
        email: bob+8@hey.com,
        id: 7e23d607-dc38-458a-ba2c-586abf498d78,
        name: Bobby Brown,
      },
      {
        age: 5,
        email: bob+9@hey.com,
        id: 70ab5a89-9ded-4394-95e3-5265b714a11d,
        name: Bobby Brown,
      },
    ]
  `)
})
