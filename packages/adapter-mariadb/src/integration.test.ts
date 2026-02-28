import { describe, expect, test } from 'vitest'

import { PrismaMariaDb } from './index'

describe('mariadb adapter integration', () => {
  test('can connect using IPv6 address [::1]', async () => {
    const connectionString = process.env.TEST_MARIADB_URI
    if (!connectionString) {
      throw new Error('TEST_MARIADB_URI environment variable is not set')
    }

    const ipv6ConnectionString = connectionString.replace('localhost', '[::1]')

    const factory = new PrismaMariaDb(ipv6ConnectionString)
    const adapter = await factory.connect()

    try {
      const result = await adapter.queryRaw({
        sql: 'SELECT 1 as value',
        args: [],
        argTypes: [],
      })

      expect(result.columnNames).toEqual(['value'])
      expect(result.rows).toEqual([[1]])
    } finally {
      await adapter.dispose()
    }
  })
})
