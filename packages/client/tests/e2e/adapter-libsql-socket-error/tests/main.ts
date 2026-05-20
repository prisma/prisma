import { PrismaLibSql } from '@prisma/adapter-libsql'
import { PrismaClient } from '@prisma/client'

// ws:// (plain WebSocket) to localhost:1 triggers ECONNREFUSED at the TCP layer,
// which the libsql adapter must map to DatabaseNotReachable (P1001).
const adapter = new PrismaLibSql({ url: 'ws://localhost:1' })
const prisma = new PrismaClient({ adapter, errorFormat: 'minimal' })

test('maps ECONNREFUSED to P1001 DatabaseNotReachable', async () => {
  await expect(prisma.user.findMany()).rejects.toMatchObject({
    name: 'PrismaClientKnownRequestError',
    code: 'P1001',
  })
})

afterAll(async () => {
  await prisma.$disconnect()
})
