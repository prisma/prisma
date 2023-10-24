import { PrismaNeonHTTP } from '@prisma/adapter-neon'
import { bindAdapter } from '@prisma/driver-adapter-utils'
import { neon } from '@neondatabase/serverless'
import { describe } from 'node:test'
import { smokeTestLibquery } from './libquery'

describe('neon (HTTP)', () => {
  const connectionString = process.env.JS_NEON_DATABASE_URL ?? ''

  const neonConnection = neon(connectionString)

  const adapter = new PrismaNeonHTTP(neonConnection)
  const driverAdapter = bindAdapter(adapter)

  smokeTestLibquery(driverAdapter, '../../prisma/postgres/schema.prisma', false)
})
