/**
 * Integration test for issue #29191: Prisma postgres local instance connection error
 * https://github.com/prisma/prisma/issues/29191
 *
 * This test verifies that the adapter correctly handles Prisma Postgres local dev URLs
 * by extracting the actual database URL from the encoded api_key parameter.
 */

import pg from 'pg'
import { describe, expect, it } from 'vitest'

import { PrismaPgAdapterFactory } from '../pg'

describe('Issue #29191 - Prisma Postgres local dev URL handling', () => {
  it('should correctly parse and use the database URL from a Prisma Postgres local dev connection string', () => {
    const apiKey = Buffer.from(
      JSON.stringify({
        databaseUrl:
          'postgres://postgres:postgres@localhost:51214/template1?sslmode=disable&connection_limit=1&connect_timeout=0&max_idle_connection_lifetime=0&pool_timeout=0&single_use_connections=true&socket_timeout=0',
        name: 'default',
        shadowDatabaseUrl:
          'postgres://postgres:postgres@localhost:51215/template1?sslmode=disable&connection_limit=1&connect_timeout=0&max_idle_connection_lifetime=0&pool_timeout=0&single_use_connections=true&socket_timeout=0',
      }),
    ).toString('base64')

    const connectionString = `prisma+postgres://localhost:51216/?api_key=${apiKey}`

    const config: pg.PoolConfig = { connectionString }
    const factory = new PrismaPgAdapterFactory(config)

    expect(factory['config'].connectionString).toBe(
      'postgres://postgres:postgres@localhost:51214/template1?sslmode=disable&connection_limit=1&connect_timeout=0&max_idle_connection_lifetime=0&pool_timeout=0&single_use_connections=true&socket_timeout=0',
    )
  })

  it('should work with the exact URL format from issue #29191', () => {
    const apiKey = Buffer.from(
      JSON.stringify({
        databaseUrl: 'postgres://postgres:postgres@localhost:51214/template1?sslmode=disable',
        name: 'apollo_db',
        shadowDatabaseUrl: 'postgres://postgres:postgres@localhost:51215/template1?sslmode=disable',
      }),
    ).toString('base64')

    const connectionString = `prisma+postgres://localhost:51216/?api_key=${apiKey}`

    const adapter = new PrismaPgAdapterFactory({ connectionString })

    expect(adapter['config'].connectionString).toBe(
      'postgres://postgres:postgres@localhost:51214/template1?sslmode=disable',
    )
  })

  it('should work with the exact URL format from issue #28773', () => {
    const apiKey =
      'eyJkYXRhYmFzZVVybCI6InBvc3RncmVzOi8vcG9zdGdyZXM6cG9zdGdyZXNAbG9jYWxob3N0OjUxMjE0L3RlbXBsYXRlMT9zc2xtb2RlPWRpc2FibGUmY29ubmVjdGlvbl9saW1pdD0xJmNvbm5lY3RfdGltZW91dD0wJm1heF9pZGxlX2Nvbm5lY3Rpb25fbGlmZXRpbWU9MCZwb29sX3RpbWVvdXQ9MCZzaW5nbGVfdXNlX2Nvbm5lY3Rpb25zPXRydWUmc29ja2V0X3RpbWVvdXQ9MCIsIm5hbWUiOiJkZWZhdWx0Iiwic2hhZG93RGF0YWJhc2VVcmwiOiJwb3N0Z3JlczovL3Bvc3RncmVzOnBvc3RncmVzQGxvY2FsaG9zdDo1MTIxNS90ZW1wbGF0ZTE_c3NsbW9kZT1kaXNhYmxlJmNvbm5lY3Rpb25fbGltaXQ9MSZjb25uZWN0X3RpbWVvdXQ9MCZtYXhfaWRsZV9jb25uZWN0aW9uX2xpZmV0aW1lPTAmcG9vbF90aW1lb3V0PTAmc2luZ2xlX3VzZV9jb25uZWN0aW9ucz10cnVlJnNvY2tldF90aW1lb3V0PTAifQ=='

    const connectionString = `prisma+postgres://localhost:51213/?api_key=${apiKey}`

    const adapter = new PrismaPgAdapterFactory({ connectionString })

    expect(adapter['config'].connectionString).toContain('postgres://postgres:postgres@localhost:51214/template1')
    expect(adapter['config'].connectionString).toContain('sslmode=disable')
  })
})
