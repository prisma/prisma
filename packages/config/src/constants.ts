/**
 * Supported database providers for Refract
 * Adding new providers should be as simple as:
 * 1. Add to this array
 * 2. Add case in dialect-factory.ts
 * 3. Add peer dependency in package.json if needed
 */
export const SUPPORTED_PROVIDERS = ['postgresql', 'mysql', 'sqlite', 'neon', 'd1'] as const

/**
 * Type derived from supported providers
 */
export type DatabaseProvider = (typeof SUPPORTED_PROVIDERS)[number]

/**
 * Provider detection patterns for automatic URL detection
 */
export const PROVIDER_URL_PATTERNS: Record<DatabaseProvider, (url: string) => boolean> = {
  postgresql: (url) => {
    const isPostgres = url.startsWith('postgresql://') || url.startsWith('postgres://')
    // Exclude special cases that have their own providers
    const isNeon = url.includes('neon.tech') || url.includes('neon.database')
    return isPostgres && !isNeon
  },

  neon: (url) => {
    const isPostgres = url.startsWith('postgresql://') || url.startsWith('postgres://')
    const isNeon = url.includes('neon.tech') || url.includes('neon.database')
    return isPostgres && isNeon
  },

  mysql: (url) => url.startsWith('mysql://'),

  sqlite: (url) =>
    url.startsWith('file:') || url.endsWith('.db') || url.endsWith('.sqlite') || url.endsWith('.sqlite3'),

  d1: (url) => url.startsWith('d1://'),
}

/**
 * Provider metadata for better error messages and documentation
 */
export const PROVIDER_METADATA: Record<
  DatabaseProvider,
  {
    name: string
    packages: string[]
    description: string
  }
> = {
  postgresql: {
    name: 'PostgreSQL',
    packages: ['pg'],
    description: 'Standard PostgreSQL driver using node-postgres',
  },

  neon: {
    name: 'Neon (Serverless PostgreSQL)',
    packages: ['@neondatabase/serverless'],
    description: 'Neon serverless PostgreSQL with connection pooling optimization',
  },

  mysql: {
    name: 'MySQL',
    packages: ['mysql2'],
    description: 'MySQL driver using mysql2',
  },

  sqlite: {
    name: 'SQLite',
    packages: ['better-sqlite3'],
    description: 'SQLite driver using better-sqlite3',
  },

  d1: {
    name: 'Cloudflare D1',
    packages: ['kysely-d1'],
    description: 'Cloudflare D1 database for Workers environment',
  },
}
