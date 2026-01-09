import { describe, expect, it } from 'vitest'

import { defineConfig, PROVIDER_URL_PATTERNS, SUPPORTED_PROVIDERS } from '../index.js'

describe('@refract/config', () => {
  describe('SUPPORTED_PROVIDERS', () => {
    it('should include all expected providers', () => {
      expect(SUPPORTED_PROVIDERS).toContain('postgresql')
      expect(SUPPORTED_PROVIDERS).toContain('mysql')
      expect(SUPPORTED_PROVIDERS).toContain('sqlite')
      expect(SUPPORTED_PROVIDERS).toContain('d1')
    })
  })

  describe('PROVIDER_URL_PATTERNS', () => {
    it('should detect postgresql URLs', () => {
      expect(PROVIDER_URL_PATTERNS.postgresql('postgresql://localhost:5432/db')).toBe(true)
      expect(PROVIDER_URL_PATTERNS.postgresql('postgres://localhost:5432/db')).toBe(true)
      expect(PROVIDER_URL_PATTERNS.postgresql('mysql://localhost:3306/db')).toBe(false)
    })

    it('should detect mysql URLs', () => {
      expect(PROVIDER_URL_PATTERNS.mysql('mysql://localhost:3306/db')).toBe(true)
      expect(PROVIDER_URL_PATTERNS.mysql('postgresql://localhost:5432/db')).toBe(false)
    })

    it('should detect sqlite URLs', () => {
      expect(PROVIDER_URL_PATTERNS.sqlite('file:./dev.db')).toBe(true)
      expect(PROVIDER_URL_PATTERNS.sqlite('./data.sqlite')).toBe(true)
      expect(PROVIDER_URL_PATTERNS.sqlite('./data.sqlite3')).toBe(true)
      expect(PROVIDER_URL_PATTERNS.sqlite('postgresql://localhost')).toBe(false)
    })

    it('should detect d1 URLs', () => {
      expect(PROVIDER_URL_PATTERNS.d1('d1://my-database')).toBe(true)
      expect(PROVIDER_URL_PATTERNS.d1('file:./dev.db')).toBe(false)
    })
  })

  describe('defineConfig', () => {
    it('should return the config unchanged', () => {
      const config = {
        datasource: {
          provider: 'postgresql' as const,
          url: 'postgresql://localhost:5432/db',
        },
        schema: './schema.prisma',
      }

      const result = defineConfig(config)
      expect(result).toEqual(config)
    })

    it('should accept sqlite config', () => {
      const config = defineConfig({
        datasource: {
          provider: 'sqlite',
          url: 'file:./dev.db',
        },
        schema: './schema.prisma',
      })

      expect(config.datasource.provider).toBe('sqlite')
    })
  })
})
