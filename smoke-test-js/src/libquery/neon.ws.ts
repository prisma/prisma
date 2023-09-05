import { PrismaNeon } from '@jkomyno/prisma-adapter-neon'
import { bindAdapter } from '@jkomyno/prisma-driver-adapter-utils'
import { WebSocket } from 'undici'
import { Pool, neonConfig } from '@neondatabase/serverless'
import { smokeTestLibquery } from './libquery' 

neonConfig.webSocketConstructor = WebSocket

async function main() {
  const connectionString = `${process.env.JS_NEON_DATABASE_URL as string}`

  const pool = new Pool({ connectionString })
  const adapter = new PrismaNeon(pool)
  const driverAdapter = bindAdapter(adapter)

  await smokeTestLibquery(driverAdapter, '../../prisma/postgres/schema.prisma')
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
