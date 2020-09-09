import { getTestClient } from '../../../../utils/getTestClient'

test('incorrect-column-type', async () => {
  const PrismaClient = await getTestClient()
  const prisma = new PrismaClient({
    log: [
      {
        emit: 'event',
        level: 'query',
      },
    ],
  })

  try {
    const data = await prisma.user.findMany()
  } catch (e) {
    prisma.$disconnect()
    expect(e.message).toMatchSnapshot()
  }
})
