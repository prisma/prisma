import { PrismaMssql } from '@prisma/adapter-mssql'
import { PrismaClient } from '@prisma/client'

jest.setTimeout(30_000)

let prisma: PrismaClient

beforeAll(() => {
  const adapter = new PrismaMssql({
    server: 'localhost',
    port: 1,
    user: 'sa',
    password: 'pass',
    database: 'nonexistent',
    options: {
      trustServerCertificate: true,
      encrypt: false,
    },
  })
  prisma = new PrismaClient({ adapter, errorFormat: 'minimal' })
})

test('maps ECONNREFUSED to P1001 DatabaseNotReachable', async () => {
  await expect(prisma.user.findMany()).rejects.toMatchObject({
    name: 'PrismaClientKnownRequestError',
    code: 'P1001',
  })
})

afterAll(async () => {
  await prisma.$disconnect()
})
