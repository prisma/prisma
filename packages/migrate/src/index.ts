/**
 * @ork/migrate - TypeScript-native migration engine for Ork ORM
 *
 * This package provides programmatic migration capabilities with direct Kysely integration,
 * eliminating custom driver abstractions and providing transparent, type-safe database operations.
 */

import { OrkMigrate } from './OrkMigrate'
import type { MigrationOptions } from './types'

export { OrkMigrate }

export type {
  AnyKyselyDatabase,
  AnyKyselyTransaction,
  DatabaseColumn,
  DatabaseForeignKey,
  DatabaseIndex,
  DatabaseSchema,
  DatabaseTable,
  DatabaseUniqueConstraint,
  DatabaseView,
  DetailedMigrationSummary,
  EnhancedMigrationHistoryEntry,
  MigrationDiff,
  MigrationError,
  MigrationHistoryEntry,
  MigrationImpact,
  MigrationLock,
  MigrationLoggingConfig,
  MigrationOptions,
  MigrationPreview,
  MigrationProgress,
  MigrationPromptConfig,
  MigrationResult,
  MigrationRollback,
  MigrationState,
  MigrationSummary,
  MigrationValidation,
} from './types.js'

/**
 * Create a new OrkMigrate instance with the provided Kysely database instance
 *
 * @param kyselyInstance - Any Kysely dialect instance (PostgreSQL, MySQL, SQLite, or D1)
 * @param options - Optional configuration for migration behavior
 * @returns OrkMigrate instance ready for diff() and apply() operations
 *
 * @example
 * ```typescript
 * import { createMigrate } from '@ork/migrate'
 * import { Kysely, PostgresDialect } from 'kysely'
 * import { Pool } from 'pg'
 *
 * const db = new Kysely({
 *   dialect: new PostgresDialect({
 *     pool: new Pool({ connectionString: process.env.DATABASE_URL! })
 *   })
 * })
 *
 * const migrate = createMigrate(db, {
 *   useTransaction: true,
 *   validateSchema: true
 * })
 *
 * // Generate migration diff
 * const diff = await migrate.diff('./prisma/schema.prisma')
 * console.log('Migration changes:', diff.summary)
 *
 * // Apply migrations
 * const result = await migrate.apply('./prisma/schema.prisma')
 * console.log('Migration result:', result.success)
 * ```
 */
export function createMigrate(options?: MigrationOptions): OrkMigrate {
  return new OrkMigrate(options)
}
