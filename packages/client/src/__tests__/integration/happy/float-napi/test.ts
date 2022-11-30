import { generateTestClient } from '../../../../utils/getTestClient'

test('float-node-api', async () => {
  await generateTestClient()
  const { PrismaClient, Prisma } = require('./node_modules/@prisma/client')

  const db = new PrismaClient()
  await db.user.deleteMany()
  const users = await db.user.findMany()
  expect(users).toMatchInlineSnapshot(`[]`)
  // 0.9215686321258545
  const test1 = 0.9215686321258545
  const create = await db.user.create({
    data: {
      float: test1,
      decimal: new Prisma.Decimal(test1),
    },
  })
  expect(create.float).toEqual(test1)
  expect(create.decimal).toEqual(new Prisma.Decimal(test1))

  //  0.1
  const test2 = 0.1
  const update = await db.user.update({
    where: { id: create.id },
    data: {
      float: test2,
      decimal: new Prisma.Decimal(test2),
    },
  })
  expect(update.float).toEqual(test2)
  expect(update.decimal).toEqual(new Prisma.Decimal(test2))

  await db.user.deleteMany()

  await db.$disconnect()
})
