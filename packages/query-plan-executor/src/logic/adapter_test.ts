import { assertEquals, assertThrows } from '@std/assert'
import { createAdapter } from './adapter.ts'
import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaMariaDb } from '@prisma/adapter-mariadb'
import { PrismaMssql } from '@prisma/adapter-mssql'

Deno.test('createAdapter - PostgreSQL protocols', () => {
  const postgresUrls = ['postgres://user:pass@localhost:5432/db', 'postgresql://user:pass@localhost:5432/db']

  for (const url of postgresUrls) {
    const adapter = createAdapter(url)
    assertEquals(adapter instanceof PrismaPg, true)
  }
})

Deno.test('createAdapter - MySQL/MariaDB protocols', () => {
  const mysqlUrls = ['mysql://user:pass@localhost:3306/db', 'mariadb://user:pass@localhost:3306/db']

  for (const url of mysqlUrls) {
    const adapter = createAdapter(url)
    assertEquals(adapter instanceof PrismaMariaDb, true)
  }
})

Deno.test('createAdapter - SQL Server protocol', () => {
  const sqlserverUrl =
    'sqlserver://localhost:1433;database=master;user=SA;password=YourStrong@Passw0rd;trustServerCertificate=true;'
  const adapter = createAdapter(sqlserverUrl)
  assertEquals(adapter instanceof PrismaMssql, true)
})

Deno.test('createAdapter - unsupported protocol', () => {
  // These URLs are valid but have unsupported protocols
  const unsupportedUrls = [
    'http://localhost:8080',
    'https://localhost:8080',
    'ftp://localhost:21',
    'mongodb://localhost:27017/db',
    'redis://localhost:6379',
  ]

  for (const url of unsupportedUrls) {
    assertThrows(() => createAdapter(url), Error, `Unsupported protocol in database URL: ${new URL(url).protocol}`)
  }
})

Deno.test('createAdapter - invalid database URLs', () => {
  // These URLs are invalid or not recognized as database URLs
  const invalidUrls = ['', 'not-a-url', 'no-protocol.com/db?param=value']

  for (const url of invalidUrls) {
    assertThrows(() => createAdapter(url), Error, 'Invalid database URL')
  }
})
