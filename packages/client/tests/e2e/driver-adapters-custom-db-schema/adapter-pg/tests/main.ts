import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from '@prisma/client'

test('pg supports custom database schema (default is: "public".<TABLE>)', async () => {
  const adapter = new PrismaPg({ connectionString: process.env.POSTGRES_URL, schema: 'base' })
  const prisma = new PrismaClient({
    errorFormat: 'minimal',
    adapter,
  })

  const USER_ID = '1'

  await prisma.user.create({
    data: {
      id: USER_ID,
    },
  })

  const baseUsers = await prisma.$queryRawUnsafe(`SELECT * FROM "base"."User" WHERE id = $1`, USER_ID)
  expect(baseUsers).toMatchObject([{ id: USER_ID }])

  await prisma.$disconnect()
})
