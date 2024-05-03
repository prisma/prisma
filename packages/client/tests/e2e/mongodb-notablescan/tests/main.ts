import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient({ errorFormat: 'minimal' })

afterAll(async () => {
  await prisma.$disconnect()
})

test('testy test', async () => {
  await prisma.user.findMany()
  console.log('Everything is fine!')
})
