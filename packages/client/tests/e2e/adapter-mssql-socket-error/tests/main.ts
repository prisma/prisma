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

// Port 1 deterministically yields ECONNREFUSED without a running SQL Server.
// ENOTFOUND/ECONNRESET/ETIMEDOUT are covered by unit tests in
// packages/adapter-mssql/src/errors.test.ts, as they are hard to trigger
// reliably from an E2E test.
test('maps ECONNREFUSED to P1001 DatabaseNotReachable', async () => {
  await expect(prisma.user.findMany()).rejects.toMatchObject({
    name: 'PrismaClientKnownRequestError',
    code: 'P1001',
  })
})

afterAll(async () => {
  await prisma?.$disconnect()
})
