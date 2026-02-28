import { describe, expect, test } from 'vitest'

import { inferCapabilities, PrismaMariaDbAdapterFactory, rewriteConnectionString } from './mariadb'

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
    expect(rewriteConnectionString(input)).toBe(expected)
  })

  test('should preserve mariadb:// connection strings', () => {
    const input = 'mariadb://user:pass@localhost:3306/db'
    expect(rewriteConnectionString(input)).toBe(input)
  })

  test('should preserve configuration objects', () => {
    const config = {
      host: 'localhost',
      port: 3306,
      user: 'user',
      password: 'pass',
      database: 'db',
    }
    expect(rewriteConnectionString(config)).toBe(config)
  })

  test('should encode username with @ symbol', () => {
    const input = 'mariadb://user@example.com:password@localhost:3306/db'
    const expected = 'mariadb://user%40example.com:password@localhost:3306/db'
    expect(rewriteConnectionString(input)).toBe(expected)
  })

  test('should encode password with special characters', () => {
    const input = 'mariadb://user:p@ss:word@localhost:3306/db'
    const expected = 'mariadb://user:p%40ss%3Aword@localhost:3306/db'
    expect(rewriteConnectionString(input)).toBe(expected)
  })

  test('should encode both username and password with special characters', () => {
    const input = 'mariadb://user@domain:p@ss:word@localhost:3306/db'
    const expected = 'mariadb://user%40domain:p%40ss%3Aword@localhost:3306/db'
    expect(rewriteConnectionString(input)).toBe(expected)
  })

  test('should not double-encode already percent-encoded credentials', () => {
    const input = 'mariadb://user%40domain:p%40ss%3Aword@localhost:3306/db'
    const expected = 'mariadb://user%40domain:p%40ss%3Aword@localhost:3306/db'
    expect(rewriteConnectionString(input)).toBe(expected)
  })

  test('should handle mysql:// with @ in username', () => {
    const input = 'mysql://user@example.com:password@localhost:3306/db'
    const expected = 'mariadb://user%40example.com:password@localhost:3306/db'
    expect(rewriteConnectionString(input)).toBe(expected)
  })
})

describe('credential sanitization', () => {
  test('connection string parse error should not expose password', async () => {
    const secretPassword = 'super_secret_password_12345'
    // IPv6 address in brackets - causes parse error in mariadb driver
    const connectionString = `mariadb://user:${secretPassword}@[64:ff9b::23be:d64c]/db`

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
