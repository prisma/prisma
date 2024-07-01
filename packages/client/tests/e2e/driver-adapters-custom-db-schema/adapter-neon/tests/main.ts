import { neonConfig, Pool } from '@neondatabase/serverless'
import { PrismaNeon } from '@prisma/adapter-neon'
import { PrismaClient } from '@prisma/client'
import { WebSocket } from 'undici'

test('neon supports custom database schema (default is: "public".<TABLE>)', async () => {
  const pool = new Pool({ connectionString: process.env.POSTGRES_URL })

  neonConfig.wsProxy = () => process.env.NEON_WS_PROXY
  neonConfig.webSocketConstructor = WebSocket
  neonConfig.useSecureWebSocket = false // disable tls
  neonConfig.pipelineConnect = false

  const adapter = new PrismaNeon(pool, { schema: 'base' })

  const prisma = new PrismaClient({
    errorFormat: 'minimal',
    adapter,
  })

  const USER_ID = '1'

  await prisma.user.create({
    data: {
      id: USER_ID,
    },
  })

  const baseUsers = await prisma.$queryRawUnsafe(`SELECT * FROM "base"."User" WHERE id = $1`, USER_ID)
  expect(baseUsers).toMatchObject([{ id: USER_ID }])

  await pool.end()
})
