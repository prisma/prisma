import { PrismaNeon } from '@prisma/adapter-neon'
import { bindAdapter } from '@prisma/driver-adapter-utils'
import { WebSocket } from 'undici'
import { Pool, neonConfig } from '@neondatabase/serverless'
import { describe } from 'node:test'
import { smokeTestLibquery } from './libquery'

neonConfig.webSocketConstructor = WebSocket

describe('neon (WebSocket)', () => {
  const connectionString = `${process.env.JS_NEON_DATABASE_URL as string}`

  const pool = new Pool({ connectionString })
  const adapter = new PrismaNeon(pool)
  const driverAdapter = bindAdapter(adapter)
  
  smokeTestLibquery(driverAdapter, '../../prisma/postgres/schema.prisma')
})
