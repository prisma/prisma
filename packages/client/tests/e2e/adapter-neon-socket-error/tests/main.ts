import { neonConfig } from '@neondatabase/serverless'
import { PrismaNeon } from '@prisma/adapter-neon'
import { PrismaClient } from '@prisma/client'
import ws from 'ws'

jest.setTimeout(30_000)

// @neondatabase/serverless requires a WebSocket constructor in Node.js;
// without it, the pool falls back to fetch and never emits a socket error.
neonConfig.webSocketConstructor = ws

let prisma: PrismaClient

beforeAll(() => {
  const adapter = new PrismaNeon({ connectionString: 'postgresql://user:pass@localhost:1/nonexistent' })
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
