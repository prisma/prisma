import { describe, expect, it, vi } from 'vitest'

import { PrismaMssqlAdapterFactory } from './mssql'

// Mock the mssql module
vi.mock('mssql', () => ({
  default: {
    ConnectionPool: vi.fn().mockImplementation(() => ({
      connect: vi.fn().mockResolvedValue(undefined),
      on: vi.fn(),
      close: vi.fn().mockResolvedValue(undefined),
    })),
  },
}))

describe('PrismaMssqlAdapterFactory', () => {
  describe('constructor with connection string', () => {
    it('should extract schema from connection string and merge with options', () => {
      const connectionString = 'sqlserver://localhost;database=testdb;schema=custom'
      const options = { onPoolError: vi.fn() }

      const factory = new PrismaMssqlAdapterFactory(connectionString, options)

      // Access private properties for testing
      const privateOptions = (factory as any).options
      expect(privateOptions.schema).toBe('custom')
      expect(privateOptions.onPoolError).toBe(options.onPoolError)
    })

    it('should use provided schema when connection string has no schema', () => {
      const connectionString = 'sqlserver://localhost;database=testdb'
      const options = { schema: 'provided' }

      const factory = new PrismaMssqlAdapterFactory(connectionString, options)

      const privateOptions = (factory as any).options
      expect(privateOptions.schema).toBe('provided')
    })

    it('should prioritize provided schema over connection string schema', () => {
      const connectionString = 'sqlserver://localhost;database=testdb;schema=connection'
      const options = { schema: 'provided' }

      const factory = new PrismaMssqlAdapterFactory(connectionString, options)

      const privateOptions = (factory as any).options
      expect(privateOptions.schema).toBe('provided')
    })

    it('should use connection string schema as fallback when no options schema', () => {
      const connectionString = 'sqlserver://localhost;database=testdb;schema=fallback'
      const options = { onPoolError: vi.fn() } // No schema in options

      const factory = new PrismaMssqlAdapterFactory(connectionString, options)

      const privateOptions = (factory as any).options
      expect(privateOptions.schema).toBe('fallback')
      expect(privateOptions.onPoolError).toBe(options.onPoolError)
    })

    it('should handle connection string without schema and no options', () => {
      const connectionString = 'sqlserver://localhost;database=testdb'

      const factory = new PrismaMssqlAdapterFactory(connectionString)

      const privateOptions = (factory as any).options
      expect(privateOptions.schema).toBeUndefined()
    })

    it('should handle connection string with schema and no options', () => {
      const connectionString = 'sqlserver://localhost;database=testdb;schema=custom'

      const factory = new PrismaMssqlAdapterFactory(connectionString)

      const privateOptions = (factory as any).options
      expect(privateOptions.schema).toBe('custom')
    })
  })

  describe('constructor with config object', () => {
    it('should work with config object and options', () => {
      const config = { server: 'localhost', database: 'testdb' }
      const options = { schema: 'custom' }

      const factory = new PrismaMssqlAdapterFactory(config, options)

      const privateConfig = (factory as any).config
      const privateOptions = (factory as any).options
      expect(privateConfig).toEqual(config)
      expect(privateOptions.schema).toBe('custom')
    })

    it('should work with config object and no options', () => {
      const config = { server: 'localhost', database: 'testdb' }

      const factory = new PrismaMssqlAdapterFactory(config)

      const privateConfig = (factory as any).config
      const privateOptions = (factory as any).options
      expect(privateConfig).toEqual(config)
      expect(privateOptions.schema).toBeUndefined()
    })
  })
})
