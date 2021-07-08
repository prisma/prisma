import { getTestClient } from '../../../../utils/getTestClient'

test('long-running transaction', async () => {
  const PrismaClient = await getTestClient()
  const prisma = new PrismaClient()

  await prisma.user.deleteMany()

  const result = await prisma.$transaction([
    prisma.user.create({
      data: {
        email: 'test@hey.com',
      },
    })
  ])
 
  console.log(result)

  await prisma.$disconnect()
})
