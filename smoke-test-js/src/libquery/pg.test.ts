import pg from 'pg'
import { PrismaPg } from '@prisma/adapter-pg'
import { bindAdapter } from '@prisma/driver-adapter-utils'
import { describe } from 'node:test'
import { smokeTestLibquery } from './libquery'

describe('pg', () => {
  const connectionString = `${process.env.JS_PG_DATABASE_URL as string}`

  const pool = new pg.Pool({ connectionString })
  const adapter = new PrismaPg(pool)
  const driverAdapter = bindAdapter(adapter)
  
  smokeTestLibquery(driverAdapter, '../../prisma/postgres/schema.prisma')
})
