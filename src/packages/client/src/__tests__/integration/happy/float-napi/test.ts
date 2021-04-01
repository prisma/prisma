import { generateTestClient } from '../../../../utils/getTestClient'

test('float-napi', async () => {
  await generateTestClient()
  const { PrismaClient } = require('./node_modules/@prisma/client')

  const db = new PrismaClient()
  const users = await db.user.findMany()
  expect(users).toMatchInlineSnapshot(`Array []`)
  const float = 0.9215686321258545
  const create = await db.user.create({
    data: {
      float: float,
    },
  })
  expect(create.float).toEqual(float)
  await db.user.deleteMany()

  db.$disconnect()
})
