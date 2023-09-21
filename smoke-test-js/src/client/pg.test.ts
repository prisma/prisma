import { describe } from 'node:test'
import pg from 'pg'
import { PrismaPg } from '@prisma/adapter-pg'
import { smokeTestClient } from './client'

describe('pg with @prisma/client', async () => {
  const connectionString = process.env.JS_PG_DATABASE_URL ?? ''

  const pool = new pg.Pool({ connectionString })
  const adapter = new PrismaPg(pool)

  smokeTestClient(adapter)
})
