import { generateTestClient } from '../../../../utils/getTestClient'

test('enums', async () => {
  await generateTestClient()
  const PrismaClient = require('./node_modules/@prisma/client').PrismaClient
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

  await await prisma.$disconnect()

  await new Promise((r) => setTimeout(r, 100))

  expect(queryEvents.length).toBeGreaterThan(0)
})
