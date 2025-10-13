/**
 * @refract/migrate - TypeScript-native migration engine for Refract ORM
 *
 * This package provides programmatic migration capabilities with direct Kysely integration,
 * eliminating custom driver abstractions and providing transparent, type-safe database operations.
 */

import { RefractMigrate } from './RefractMigrate'
import type { MigrationOptions } from './types'

export { RefractMigrate }

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
 * Create a new RefractMigrate instance with the provided Kysely database instance
 *
 * @param kyselyInstance - Any Kysely dialect instance (kysely-neon, kysely-d1, etc.)
 * @param options - Optional configuration for migration behavior
 * @returns RefractMigrate instance ready for diff() and apply() operations
 *
 * @example
 * ```typescript
 * import { createMigrate } from '@refract/migrate'
 * import { Kysely, PostgresDialect } from 'kysely'
 * import { Pool } from 'pg'
 *
 * const db = new Kysely({
 *   dialect: new PostgresDialect({
 *     pool: new Pool({ connectionString: process.env.DATABASE_URL })
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
export function createMigrate(options?: MigrationOptions): RefractMigrate {
  return new RefractMigrate(options)
}
