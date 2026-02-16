import { describe, expect, it } from 'vitest'

import { extractDatabaseUrl, isPrismaPostgresLocalDevUrl, toPostgresConnectionString } from '../prisma-postgres-local'

describe('isPrismaPostgresLocalDevUrl', () => {
  it('returns true for prisma+postgres://localhost URLs', () => {
    expect(isPrismaPostgresLocalDevUrl('prisma+postgres://localhost:5432')).toBe(true)
    expect(isPrismaPostgresLocalDevUrl('prisma+postgres://localhost:51213/?api_key=xxx')).toBe(true)
  })

  it('returns true for prisma+postgres://127.0.0.1 URLs', () => {
    expect(isPrismaPostgresLocalDevUrl('prisma+postgres://127.0.0.1:5432')).toBe(true)
  })

  it('returns true for prisma+postgres://[::1] URLs', () => {
    expect(isPrismaPostgresLocalDevUrl('prisma+postgres://[::1]:5432')).toBe(true)
  })

  it('returns true for prisma+postgres://[0:0:0:0:0:0:0:1] URLs (normalized to [::1])', () => {
    // URL parser normalizes the expanded IPv6 form to compressed form
    expect(isPrismaPostgresLocalDevUrl('prisma+postgres://[0:0:0:0:0:0:0:1]:5432')).toBe(true)
  })

  it('returns false for prisma+postgres:// URLs with non-localhost hosts', () => {
    expect(isPrismaPostgresLocalDevUrl('prisma+postgres://accelerate.prisma-data.net')).toBe(false)
    expect(isPrismaPostgresLocalDevUrl('prisma+postgres://example.com:5432')).toBe(false)
  })

  it('returns false for regular postgres:// URLs', () => {
    expect(isPrismaPostgresLocalDevUrl('postgres://localhost:5432')).toBe(false)
    expect(isPrismaPostgresLocalDevUrl('postgresql://localhost:5432')).toBe(false)
  })

  it('returns false for invalid URLs', () => {
    expect(isPrismaPostgresLocalDevUrl('not a url')).toBe(false)
    expect(isPrismaPostgresLocalDevUrl('http://localhost')).toBe(false)
  })

  it('accepts URL objects', () => {
    expect(isPrismaPostgresLocalDevUrl(new URL('prisma+postgres://localhost:5432'))).toBe(true)
    expect(isPrismaPostgresLocalDevUrl(new URL('postgres://localhost:5432'))).toBe(false)
  })
})

describe('extractDatabaseUrl', () => {
  it('extracts the database URL from a valid Prisma Postgres local dev URL', () => {
    const apiKey = Buffer.from(
      JSON.stringify({
        databaseUrl: 'postgres://postgres:postgres@localhost:51214/template1?sslmode=disable',
        name: 'default',
        shadowDatabaseUrl: 'postgres://postgres:postgres@localhost:51215/template1?sslmode=disable',
      }),
    ).toString('base64')

    const url = `prisma+postgres://localhost:51213/?api_key=${apiKey}`
    const result = extractDatabaseUrl(url)

    expect(result).toBe('postgres://postgres:postgres@localhost:51214/template1?sslmode=disable')
  })

  it('throws an error if the URL is not a Prisma Postgres local dev URL', () => {
    expect(() => extractDatabaseUrl('postgres://localhost:5432')).toThrow('Invalid Prisma Postgres local dev URL')
    expect(() => extractDatabaseUrl('prisma+postgres://example.com:5432')).toThrow(
      'Invalid Prisma Postgres local dev URL',
    )
  })

  it('throws an error if api_key parameter is missing', () => {
    expect(() => extractDatabaseUrl('prisma+postgres://localhost:5432')).toThrow('Missing api_key parameter')
  })

  it('throws an error if api_key cannot be decoded', () => {
    expect(() => extractDatabaseUrl('prisma+postgres://localhost:5432/?api_key=invalid-base64!!!')).toThrow(
      'Invalid api_key format',
    )
  })

  it('throws an error if decoded api_key does not contain databaseUrl', () => {
    const apiKey = Buffer.from(JSON.stringify({ name: 'default' })).toString('base64')
    expect(() => extractDatabaseUrl(`prisma+postgres://localhost:5432/?api_key=${apiKey}`)).toThrow(
      'Invalid api_key structure',
    )
  })

  it('accepts URL objects', () => {
    const apiKey = Buffer.from(
      JSON.stringify({
        databaseUrl: 'postgres://localhost:5432/test',
        name: 'default',
        shadowDatabaseUrl: 'postgres://localhost:5433/test',
      }),
    ).toString('base64')

    const url = new URL(`prisma+postgres://localhost:51213/?api_key=${apiKey}`)
    const result = extractDatabaseUrl(url)

    expect(result).toBe('postgres://localhost:5432/test')
  })
})

describe('toPostgresConnectionString', () => {
  it('extracts database URL from Prisma Postgres local dev URLs', () => {
    const apiKey = Buffer.from(
      JSON.stringify({
        databaseUrl: 'postgres://postgres:postgres@localhost:51214/template1',
        name: 'default',
        shadowDatabaseUrl: 'postgres://postgres:postgres@localhost:51215/template1',
      }),
    ).toString('base64')

    const url = `prisma+postgres://localhost:51213/?api_key=${apiKey}`
    const result = toPostgresConnectionString(url)

    expect(result).toBe('postgres://postgres:postgres@localhost:51214/template1')
  })

  it('returns regular postgres:// URLs as-is', () => {
    const url = 'postgres://localhost:5432/mydb'
    expect(toPostgresConnectionString(url)).toBe(url)
  })

  it('returns postgresql:// URLs as-is', () => {
    const url = 'postgresql://user:pass@localhost:5432/mydb'
    expect(toPostgresConnectionString(url)).toBe(url)
  })

  it('returns non-localhost prisma+postgres:// URLs as-is', () => {
    const url = 'prisma+postgres://accelerate.prisma-data.net/?api_key=xxx'
    expect(toPostgresConnectionString(url)).toBe(url)
  })

  it('accepts URL objects', () => {
    const apiKey = Buffer.from(
      JSON.stringify({
        databaseUrl: 'postgres://localhost:5432/test',
        name: 'default',
        shadowDatabaseUrl: 'postgres://localhost:5433/test',
      }),
    ).toString('base64')

    const url = new URL(`prisma+postgres://localhost:51213/?api_key=${apiKey}`)
    const result = toPostgresConnectionString(url)

    expect(result).toBe('postgres://localhost:5432/test')
  })
})
