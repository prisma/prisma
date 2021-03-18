import { getTestClient } from '../../../../utils/getTestClient'

test('enums', async () => {
  // works in isolation
  if (process.env.PRISMA_FORCE_NAPI) {
    return
  }
  const PrismaClient = await getTestClient()
  const prisma = new PrismaClient({
    log: [
      {
        emit: 'event',
        level: 'query',
      },
    ],
  })

  const queryEvents: any[] = []

  prisma.$on('query', (e) => queryEvents.push(e))

  await prisma.user.findMany({})

  await prisma.$disconnect()

  await new Promise((r) => setTimeout(r, 100))

  expect(queryEvents.length).toBeGreaterThan(0)
})
