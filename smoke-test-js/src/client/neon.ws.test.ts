import { describe } from 'node:test'
import { Pool, neonConfig } from '@neondatabase/serverless'
import { PrismaNeon } from '@jkomyno/prisma-adapter-neon'
import { WebSocket } from 'undici'
import { smokeTestClient } from './client'

neonConfig.webSocketConstructor = WebSocket

describe('neon with @prisma/client', async () => {
  const connectionString = `${process.env.JS_NEON_DATABASE_URL as string}`

  const pool = new Pool({ connectionString })
  const adapter = new PrismaNeon(pool)

  smokeTestClient(adapter)
})
