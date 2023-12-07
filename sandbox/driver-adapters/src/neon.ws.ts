import { Pool, neonConfig } from '@neondatabase/serverless'
import { PrismaNeon } from '@prisma/adapter-neon'
import { WebSocket } from 'undici'
import { smokeTest } from './test'

neonConfig.webSocketConstructor = WebSocket

async function main() {
  const connectionString = `${process.env.JS_NEON_DATABASE_URL as string}`

  const pool = new Pool({
    connectionString,
  })
  const adapter = new PrismaNeon(pool)

  await smokeTest(adapter)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
