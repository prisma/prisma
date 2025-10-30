import { PrismaMariaDb } from '@prisma/adapter-mariadb'
import { PrismaClient } from '@prisma/client'

const url = new URL(process.env['MYSQL_URL']!)
const { username: user, password, hostname: host, port } = url
const database = url.pathname && url.pathname.slice(1)

const adapter = new PrismaMariaDb({
  user,
  password,
  database,
  host,
  port: Number(port),
  connectionLimit: 4, // avoid running out of connections, some tests create multiple clients
})
const prisma = new PrismaClient({ errorFormat: 'minimal', adapter })

afterAll(async () => {
  await prisma.$disconnect()
})

test.failing('reports correct error message on connection limit reached', async () => {
  // expect.assertions(1)
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
