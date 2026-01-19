import { describe, expect, it } from 'vitest'

import {
  createConfigWithAutoDetection,
  detectProviderFromUrl,
  validateProviderUrlCompatibility,
} from '../utils/config.js'

describe('Configuration Bridge Utilities', () => {
  describe('detectProviderFromUrl', () => {
    describe('PostgreSQL family detection', () => {
      it('should detect standard postgresql provider', () => {
        expect(detectProviderFromUrl('postgresql://user:pass@localhost:5432/db')).toBe('postgresql')
        expect(detectProviderFromUrl('postgres://user:pass@localhost:5432/db')).toBe('postgresql')
        expect(detectProviderFromUrl('postgresql://user:pass@railway.app:5432/db')).toBe('postgresql')
        expect(detectProviderFromUrl('postgresql://user:pass@render.com:5432/db')).toBe('postgresql')
      })
    })

    describe('MySQL family detection', () => {
      it('should detect mysql provider', () => {
        expect(detectProviderFromUrl('mysql://user:pass@localhost:3306/db')).toBe('mysql')
        expect(detectProviderFromUrl('mysql://user:pass@planetscale.com:3306/db')).toBe('mysql')
        expect(detectProviderFromUrl('mysql://user:pass@aws.rds.com:3306/db')).toBe('mysql')
      })
    })

    describe('SQLite family detection', () => {
      it('should detect sqlite provider from file URLs', () => {
        expect(detectProviderFromUrl('file:./dev.db')).toBe('sqlite')
        expect(detectProviderFromUrl('file:./database.sqlite')).toBe('sqlite')
        expect(detectProviderFromUrl('file:./test.sqlite3')).toBe('sqlite')
        expect(detectProviderFromUrl('file:/absolute/path/to/db.sqlite')).toBe('sqlite')
      })

      it('should detect sqlite provider from file extensions', () => {
        expect(detectProviderFromUrl('./dev.db')).toBe('sqlite')
        expect(detectProviderFromUrl('./database.sqlite')).toBe('sqlite')
        expect(detectProviderFromUrl('./test.sqlite3')).toBe('sqlite')
        expect(detectProviderFromUrl('/absolute/path/to/database.db')).toBe('sqlite')
      })
    })

    describe('D1 family detection', () => {
      it('should detect d1 provider', () => {
        expect(detectProviderFromUrl('d1://my-database')).toBe('d1')
        expect(detectProviderFromUrl('d1://production-db')).toBe('d1')
      })
    })

    describe('Error handling', () => {
      it('should throw descriptive error for unknown URL formats', () => {
        expect(() => detectProviderFromUrl('unknown://test')).toThrow(
          'Unable to detect provider from URL: unknown://test. Supported formats: postgresql://, mysql://, file:, d1://',
        )
        expect(() => detectProviderFromUrl('redis://localhost:6379')).toThrow('Supported formats')
        expect(() => detectProviderFromUrl('mongodb://localhost:27017')).toThrow('Supported formats')
        expect(() => detectProviderFromUrl('')).toThrow('Supported formats')
        expect(() => detectProviderFromUrl('invalid-url')).toThrow('Supported formats')
      })
    })
  })

  describe('createConfigWithAutoDetection', () => {
    it('should create config with auto-detected postgresql provider', () => {
      const config = createConfigWithAutoDetection('postgresql://user:pass@localhost:5432/db')

      expect(config.datasource.provider).toBe('postgresql')
      expect(config.datasource.url).toBe('postgresql://user:pass@localhost:5432/db')
      expect(config.schema).toBe('./schema.prisma')
    })

    it('should create config with auto-detected mysql provider', () => {
      const config = createConfigWithAutoDetection('mysql://user:pass@localhost:3306/db')

      expect(config.datasource.provider).toBe('mysql')
      expect(config.datasource.url).toBe('mysql://user:pass@localhost:3306/db')
      expect(config.schema).toBe('./schema.prisma')
    })

    it('should create config with auto-detected sqlite provider', () => {
      const config = createConfigWithAutoDetection('file:./dev.db')

      expect(config.datasource.provider).toBe('sqlite')
      expect(config.datasource.url).toBe('file:./dev.db')
      expect(config.schema).toBe('./schema.prisma')
    })

    it('should create config with auto-detected d1 provider', () => {
      const config = createConfigWithAutoDetection('d1://my-database')

      expect(config.datasource.provider).toBe('d1')
      expect(config.datasource.url).toBe('d1://my-database')
      expect(config.schema).toBe('./schema.prisma')
    })

    it('should merge with provided options', () => {
      const config = createConfigWithAutoDetection('postgresql://user:pass@localhost:5432/db', {
        schema: './custom.prisma',
        datasource: { shadowDatabaseUrl: 'postgresql://shadow' },
      })

      expect(config.datasource.provider).toBe('postgresql')
      expect(config.datasource.url).toBe('postgresql://user:pass@localhost:5432/db')
      expect(config.datasource.shadowDatabaseUrl).toBe('postgresql://shadow')
      expect(config.schema).toBe('./custom.prisma')
    })

    it('should override auto-detected provider with explicit datasource options', () => {
      const config = createConfigWithAutoDetection('postgresql://user:pass@localhost:5432/db', {
        datasource: { provider: 'postgresql' },
      })

      expect(config.datasource.provider).toBe('postgresql') // Explicit override
      expect(config.datasource.url).toBe('postgresql://user:pass@localhost:5432/db')
    })

    it('should throw error for invalid URLs', () => {
      expect(() => createConfigWithAutoDetection('invalid://test')).toThrow('Unable to detect provider from URL')
      expect(() => createConfigWithAutoDetection('')).toThrow('Unable to detect provider from URL')
      expect(() => createConfigWithAutoDetection('not-a-url')).toThrow('Unable to detect provider from URL')
    })
  })

  describe('validateProviderUrlCompatibility', () => {
    it('should pass for compatible provider and URL', () => {
      expect(() => validateProviderUrlCompatibility('postgresql', 'postgresql://localhost/db')).not.toThrow()
      expect(() => validateProviderUrlCompatibility('mysql', 'mysql://localhost/db')).not.toThrow()
    })

    it('should fail for incompatible provider and URL', () => {
      const result1 = validateProviderUrlCompatibility('mysql', 'postgresql://localhost/db')
      expect(result1.isValid).toBe(false)
      expect(result1.message).toContain('not compatible')

      const result2 = validateProviderUrlCompatibility('sqlite', 'mysql://localhost/db')
      expect(result2.isValid).toBe(false)
      expect(result2.message).toContain('not compatible')
    })

    it('should allow postgresql URLs', () => {
      const result2 = validateProviderUrlCompatibility('postgresql', 'postgresql://localhost/db')
      expect(result2.isValid).toBe(true)
    })
  })
})
