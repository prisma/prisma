import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/driver-pg'

const prisma = new PrismaClient({
  errorFormat: 'minimal',
  driver: new PrismaPg({ connectionString: process.env.POSTGRES_URL }),
})

test('reports correct self-signed certificate message', async () => {
  const err = prisma.user.findMany()
  await expect(err).rejects.toMatchInlineSnapshot(`
[PrismaClientKnownRequestError:
Invalid \`prisma.user.findMany()\` invocation:


Error opening a TLS connection: self-signed certificate]
`)
})

afterAll(async () => {
  await prisma.$disconnect()
})
