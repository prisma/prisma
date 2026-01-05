import type { Dialect } from 'kysely'

import { PROVIDER_METADATA } from './constants.js'
import type { RefractConfig } from './types.js'

/**
 * Create Kysely dialect instance from Refract configuration
 * This centralizes all provider-specific dialect creation logic
 */
export async function createKyselyDialect(config: RefractConfig): Promise<Dialect> {
  const { provider, url } = config.datasource

  switch (provider) {
    case 'postgresql': {
      const { PostgresDialect } = await import('kysely')

      try {
        const pgModule = await import('pg')
        const Pool = (pgModule as any).Pool ?? (pgModule as any).default?.Pool ?? (pgModule as any).default
        if (!Pool) {
          throw new Error('Pool constructor not found in pg module')
        }
        return new PostgresDialect({
          pool: new Pool({
            connectionString: url,
          }),
        })
      } catch (importError) {
        const metadata = PROVIDER_METADATA.postgresql
        throw new Error(
          `${metadata.name} provider requires ${metadata.packages.join(', ')} package(s). ` +
            `Install with: npm install ${metadata.packages.join(' ')}. ` +
            `Original error: ${importError instanceof Error ? importError.message : String(importError)}`,
        )
      }
    }

    case 'mysql': {
      try {
        const { MysqlDialect } = await import('kysely')
        const { createPool } = await import('mysql2')

        return new MysqlDialect({
          pool: createPool({
            uri: url,
          }),
        })
      } catch (importError) {
        const metadata = PROVIDER_METADATA.mysql
        throw new Error(
          `${metadata.name} provider requires ${metadata.packages.join(', ')} package(s). ` +
            `Install with: npm install ${metadata.packages.join(' ')}. ` +
            `Original error: ${importError instanceof Error ? importError.message : String(importError)}`,
        )
      }
    }

    case 'sqlite': {
      try {
        const { SqliteDialect } = await import('kysely')
        const Database = await import('better-sqlite3').then((m) => m.default)

        const dbPath = url.replace('file:', '')
        return new SqliteDialect({
          database: new Database(dbPath),
        })
      } catch (importError) {
        const metadata = PROVIDER_METADATA.sqlite
        throw new Error(
          `${metadata.name} provider requires ${metadata.packages.join(', ')} package(s). ` +
            `Install with: npm install ${metadata.packages.join(' ')}. ` +
            `Original error: ${importError instanceof Error ? importError.message : String(importError)}`,
        )
      }
    }

    case 'd1': {
      try {
        const d1Module = await import('kysely-d1')
        const { D1Dialect } = d1Module

        if (!url.startsWith('d1://')) {
          throw new Error('D1 provider requires a connection URL starting with "d1://"')
        }

        // D1 database must be available in Cloudflare Workers environment
        const d1Database = (globalThis as any).D1DATABASE
        if (!d1Database) {
          throw new Error(
            'D1 database binding not found. Ensure D1DATABASE is available in your Cloudflare Workers environment.',
          )
        }

        return new D1Dialect({
          database: d1Database,
        })
      } catch (importError) {
        const metadata = PROVIDER_METADATA.d1
        throw new Error(
          `${metadata.name} provider requires ${metadata.packages.join(', ')} package(s). ` +
            `Install with: npm install ${metadata.packages.join(' ')}. ` +
            `Original error: ${importError instanceof Error ? importError.message : String(importError)}`,
        )
      }
    }

    default:
      // TypeScript should prevent this, but good to have runtime safety
      throw new Error(`Unsupported database provider: ${(config.datasource as any).provider}`)
  }
}

/**
 * Validate database connection using the created dialect
 */
export async function validateConnection(config: RefractConfig): Promise<boolean> {
  try {
    const dialect = await createKyselyDialect(config)
    const { Kysely, sql } = await import('kysely')

    const db = new Kysely({ dialect })

    // Simple connection test
    await sql`SELECT 1`.execute(db)
    await db.destroy()

    return true
  } catch (error) {
    return false
  }
}
