import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient({ errorFormat: 'minimal' })

afterAll(async () => {
  await prisma.$disconnect()
})

test('reports correct error message on connection limit reached', async () => {
  expect.assertions(1)
  await expect(
    Promise.all([
      prisma.user.findMany(),
      prisma.user.findMany(),
      prisma.user.findMany(),
      prisma.user.findMany(),
      prisma.user.findMany(),
    ]),
  ).rejects.toMatchInlineSnapshot(`
[PrismaClientKnownRequestError: 
Invalid \`prisma.user.findMany()\` invocation:


Too many database connections opened: ERROR HY000 (1040): Too many connections
Prisma Accelerate has built-in connection pooling to prevent such errors: https://pris.ly/client/error-accelerate]
`)
})
