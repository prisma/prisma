import { PrismaMariaDb } from '@prisma/adapter-mariadb'
import { PrismaMssql } from '@prisma/adapter-mssql'
import { PrismaPg } from '@prisma/adapter-pg'
import { beforeEach, describe, expect, test, vi } from 'vitest'

import { createAdapter } from './adapter'

vi.mock('@prisma/adapter-pg')

beforeEach(() => {
  vi.clearAllMocks()
})

describe('createAdapter', () => {
  test('PostgreSQL protocols', () => {
    const postgresUrls = ['postgres://user:pass@localhost:5432/db', 'postgresql://user:pass@localhost:5432/db']

    for (const url of postgresUrls) {
      const adapter = createAdapter(url)
      expect(adapter).toBeInstanceOf(PrismaPg)
    }
  })

  test('MySQL/MariaDB protocols', () => {
    const mysqlUrls = ['mysql://user:pass@localhost:3306/db', 'mariadb://user:pass@localhost:3306/db']

    for (const url of mysqlUrls) {
      const adapter = createAdapter(url)
      expect(adapter).toBeInstanceOf(PrismaMariaDb)
    }
  })

  test('SQL Server protocol', () => {
    const sqlserverUrl =
      'sqlserver://localhost:1433;database=master;user=SA;password=YourStrong@Passw0rd;trustServerCertificate=true;'
    const adapter = createAdapter(sqlserverUrl)
    expect(adapter).toBeInstanceOf(PrismaMssql)
  })

  test('unsupported protocol', () => {
    // These URLs are valid but have unsupported protocols
    const unsupportedUrls = [
      'http://localhost:8080',
      'https://localhost:8080',
      'ftp://localhost:21',
      'mongodb://localhost:27017/db',
      'redis://localhost:6379',
    ]

    for (const url of unsupportedUrls) {
      expect(() => createAdapter(url)).toThrowError(`Unsupported protocol in database URL: ${new URL(url).protocol}`)
    }
  })

  test('invalid database URLs', () => {
    // These URLs are invalid or not recognized as database URLs
    const invalidUrls = ['', 'not-a-url', 'no-protocol.com/db?param=value']

    for (const url of invalidUrls) {
      expect(() => createAdapter(url)).toThrowError('Invalid database URL')
    }
  })
})

describe('PostgreSQL TLS parameters', () => {
  test("SSL params aren't added if not originally present", () => {
    const url = 'postgresql://user:pass@localhost:5432/db'
    createAdapter(url)

    expect(PrismaPg).toHaveBeenCalledWith({
      connectionString: url,
    })
  })

  test("sslmode=disable isn't modified", () => {
    const url = 'postgresql://user:pass@localhost:5432/db?sslmode=disable'
    createAdapter(url)

    expect(PrismaPg).toHaveBeenCalledWith({
      connectionString: url,
    })
  })

  test('sslmode values that enable SSL without certificate verification', () => {
    const modesWithoutVerification = ['prefer', 'require', 'no-verify']

    for (const mode of modesWithoutVerification) {
      vi.clearAllMocks()
      const url = `postgresql://user:pass@localhost:5432/db?sslmode=${mode}`
      createAdapter(url)

      expect(PrismaPg).toHaveBeenCalledWith({
        connectionString: 'postgresql://user:pass@localhost:5432/db?sslmode=no-verify',
      })
    }
  })

  test('sslmode values that enable SSL with certificate verification', () => {
    const modesWithVerification = ['verify-ca', 'verify-full']

    for (const mode of modesWithVerification) {
      vi.clearAllMocks()
      const url = `postgresql://user:pass@localhost:5432/db?sslmode=${mode}`
      createAdapter(url)

      expect(PrismaPg).toHaveBeenCalledWith({
        connectionString: url,
      })
    }
  })

  test('custom certificate parameters should throw error', () => {
    const certParams = ['sslcert', 'sslkey', 'sslrootcert']

    for (const param of certParams) {
      const url = `postgresql://user:pass@localhost:5432/db?${param}=/path/to/cert`
      expect(() => createAdapter(url)).toThrowError(
        'Unsupported parameters in connection string: uploading and using custom TLS certificates is not currently supported',
      )
    }
  })
})
