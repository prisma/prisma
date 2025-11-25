import { PrismaBetterSqlite3 } from './better-sqlite3'

describe('SQLite busy_timeout parameter', () => {
  test('should set busy_timeout from URL parameter', async () => {
    const adapter = new PrismaBetterSqlite3({
      url: './test-busy-timeout.db?busy_timeout=5000',
    })

    const client = await adapter.connect()
    
    // Query the busy_timeout pragma to verify it was set
    const result = await client.queryRaw({
      sql: 'PRAGMA busy_timeout',
      args: [],
      argTypes: [],
    })

    expect(result.rows[0]).toEqual([5000])
    
    await client.dispose()
  })

  test('should work with file:// protocol and busy_timeout', async () => {
    const adapter = new PrismaBetterSqlite3({
      url: 'file:./test-busy-timeout-file.db?busy_timeout=3000',
    })

    const client = await adapter.connect()
    
    const result = await client.queryRaw({
      sql: 'PRAGMA busy_timeout',
      args: [],
      argTypes: [],
    })

    expect(result.rows[0]).toEqual([3000])
    
    await client.dispose()
  })

  test('should handle invalid busy_timeout gracefully', async () => {
    const adapter = new PrismaBetterSqlite3({
      url: './test-busy-timeout-invalid.db?busy_timeout=invalid',
    })

    const client = await adapter.connect()
    
    // Should not throw and should use default timeout
    const result = await client.queryRaw({
      sql: 'PRAGMA busy_timeout',
      args: [],
      argTypes: [],
    })

    // Default busy_timeout is 0
    expect(result.rows[0]).toEqual([0])
    
    await client.dispose()
  })
})