import type { PoolConfig } from 'mariadb'
import { describe, expect, test } from 'vitest'

import { inferCapabilities, parseConnectionString, PrismaMariaDbAdapterFactory } from './mariadb'

describe.each([
  ['8.0.12', { supportsRelationJoins: false }],
  ['8.0.13', { supportsRelationJoins: true }],
  ['8.1.0', { supportsRelationJoins: true }],
  ['8.4.5', { supportsRelationJoins: true }],
  ['8.4.13', { supportsRelationJoins: true }],
  ['11.4.7-MariaDB-ubu2404', { supportsRelationJoins: false }],
])('infer capabilities for %s', (version, capabilities) => {
  test(`inferCapabilities(${version})`, () => {
    expect(inferCapabilities(version)).toEqual(capabilities)
  })
})

describe('rewriteConnectionString', () => {
  test('should rewrite mysql:// to mariadb://', () => {
    const input = 'mysql://user:password@localhost:3306/database?ssl=true&connectionLimit=10&charset=utf8mb4'
    const expected = 'mariadb://user:password@localhost:3306/database?ssl=true&connectionLimit=10&charset=utf8mb4'
    expect(parseConnectionString(input)).toBe(expected)
  })

  test('should preserve mariadb:// connection strings', () => {
    const input = 'mariadb://user:pass@localhost:3306/db'
    expect(parseConnectionString(input)).toBe(input)
  })

  test('should preserve configuration objects', () => {
    const config = {
      host: 'localhost',
      port: 3306,
      user: 'user',
      password: 'pass',
      database: 'db',
    }
    expect(parseConnectionString(config)).toBe(config)
  })

  test('should convert IPv6 connection string to config object', () => {
    const input = 'mysql://user:pass@[::1]:3306/db'
    const result = parseConnectionString(input) as PoolConfig
    expect(result).toEqual({
      host: '::1',
      port: 3306,
      user: 'user',
      password: 'pass',
      database: 'db',
    })
  })

  test('should handle IPv6 connection string with query parameters', () => {
    const input = 'mariadb://user:pass@[2001:db8::1]:3306/mydb?connectionLimit=10&ssl=true'
    const result = parseConnectionString(input) as PoolConfig
    // Numeric params are passed as strings - mariadb driver handles conversion via Number()
    expect(result).toEqual({
      host: '2001:db8::1',
      port: 3306,
      user: 'user',
      password: 'pass',
      database: 'mydb',
      connectionLimit: '10',
      ssl: true,
    })
  })

  test('should handle IPv6 connection string without port', () => {
    const input = 'mysql://user:pass@[::1]/db'
    const result = parseConnectionString(input) as PoolConfig
    expect(result).toEqual({
      host: '::1',
      user: 'user',
      password: 'pass',
      database: 'db',
    })
  })

  test('should handle URL-encoded credentials in IPv6 connection strings', () => {
    const input = 'mysql://user%40domain:p%40ss%2Fword@[::1]:3306/db'
    const result = parseConnectionString(input) as PoolConfig
    expect(result).toEqual({
      host: '::1',
      port: 3306,
      user: 'user@domain',
      password: 'p@ss/word',
      database: 'db',
    })
  })

  test('should pass through unknown query parameters for IPv6 connections', () => {
    const input = 'mysql://user:pass@[::1]:3306/db?customParam=value&connectTimeout=5000'
    const result = parseConnectionString(input) as PoolConfig
    // Numeric params are passed as strings - mariadb driver handles conversion via Number()
    expect(result).toEqual({
      host: '::1',
      port: 3306,
      user: 'user',
      password: 'pass',
      database: 'db',
      customParam: 'value',
      connectTimeout: '5000',
    })
  })

  test('should handle ssl=false in IPv6 connection strings', () => {
    const input = 'mysql://user:pass@[::1]:3306/db?ssl=false'
    const result = parseConnectionString(input) as PoolConfig
    expect(result).toEqual({
      host: '::1',
      port: 3306,
      user: 'user',
      password: 'pass',
      database: 'db',
      ssl: false,
    })
  })
})

describe('credential sanitization', () => {
  test('connection string parse error should not expose password', async () => {
    const secretPassword = 'super_secret_password_12345'
    // Malformed URL with no host (only port) - causes parse error in mariadb driver
    const connectionString = `mariadb://user:${secretPassword}@:3306/db`

    const factory = new PrismaMariaDbAdapterFactory(connectionString)

    try {
      await factory.connect()
      expect.fail('Expected connection to fail')
    } catch (error) {
      const errorMessage = String(error)
      expect(errorMessage).not.toContain(secretPassword)
    }
  })
})
