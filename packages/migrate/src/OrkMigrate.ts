import type { DatabaseDialect } from '@ork/field-translator'
import { transformationRegistry } from '@ork/field-translator'
import type { AttributeArgumentAST, AttributeAST, EnumAST, FieldAST, ModelAST, SchemaAST } from '@ork/schema-parser'
import { parseSchema } from '@ork/schema-parser'
import { sql } from 'kysely'

import type {
  AnyKyselyDatabase,
  AnyKyselyTransaction,
  DatabaseColumn,
  DatabaseEnum,
  DatabaseForeignKey,
  DatabaseIndex,
  DatabaseSchema,
  DatabaseTable,
  DatabaseUniqueConstraint,
  DefaultValue,
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
  MigrationSummary,
  MigrationValidation,
} from './types'

type SqliteCapabilities = {
  version: string
  supportsRenameColumn: boolean
  supportsDropColumn: boolean
}

const INTERNAL_MIGRATION_TABLES = new Set(['_ork_migrations', '_ork_migration_locks'])

/**
 * Main migration engine class that works directly with Kysely dialect instances
 */
export class OrkMigrate {
  // TODO: Split this class into focused modules (diffing, execution, history/locks, preview/logging).
  // TODO: Route all warnings through the logging helper or injected logger instead of console.warn.
  private readonly options: Required<MigrationOptions>

  constructor(options: MigrationOptions = {}) {
    this.options = {
      useTransaction: true,
      timeout: 30000,
      validateSchema: true,
      migrationTableName: '_ork_migrations',
      ...options,
    }
  }

  async diff(kyselyInstance: AnyKyselyDatabase, schemaPath: string): Promise<MigrationDiff> {
    try {
      const schemaAST = this.parseSchema(schemaPath)

      const currentSchema = await this.introspectDatabase(kyselyInstance)

      const dialect = this.getDialectFromSchema(schemaAST)
      const sqliteCapabilities = dialect === 'sqlite' ? await this.getSqliteCapabilities(kyselyInstance) : null

      const diff = this.generateDiff(kyselyInstance, currentSchema, schemaAST, dialect, sqliteCapabilities)

      return diff
    } catch (error) {
      throw new Error(`Failed to generate migration diff: ${error instanceof Error ? error.message : String(error)}`)
    }
  }

  async apply(kyselyInstance: AnyKyselyDatabase, schemaPath: string): Promise<MigrationResult> {
    const startTime = Date.now()
    let lock: MigrationLock | null = null

    try {
      // Check if another migration is already running
      if (await this.isMigrationLocked(kyselyInstance)) {
        throw new Error('Another migration is currently in progress')
      }

      const migrationDiff = await this.diff(kyselyInstance, schemaPath)

      if (migrationDiff.statements.length === 0) {
        return {
          success: true,
          statementsExecuted: 0,
          executionTime: Date.now() - startTime,
          errors: [],
        }
      }

      // Acquire lock for this migration
      const migrationId = `migration_${Date.now()}`
      lock = await this.acquireMigrationLock(kyselyInstance, migrationId)

      const result = this.options.useTransaction
        ? await this.executeInTransaction(kyselyInstance, migrationDiff)
        : await this.executeStatements(kyselyInstance, migrationDiff)

      if (result.success) {
        await this.recordMigration(kyselyInstance, migrationDiff, result.executionTime)
      }

      return {
        ...result,
        executionTime: Date.now() - startTime,
      }
    } catch (error) {
      return {
        success: false,
        statementsExecuted: 0,
        executionTime: Date.now() - startTime,
        errors: [
          {
            message: error instanceof Error ? error.message : String(error),
            stack: error instanceof Error ? error.stack : undefined,
          },
        ],
      }
    } finally {
      if (lock) {
        await this.releaseMigrationLock(kyselyInstance, lock)
      }
    }
  }

  async getHistory(kyselyInstance: AnyKyselyDatabase): Promise<MigrationHistoryEntry[]> {
    try {
      await this.ensureMigrationTableExists(kyselyInstance)

      const result = await kyselyInstance
        .selectFrom(this.options.migrationTableName)
        .selectAll()
        .orderBy('appliedAt', 'desc')
        .execute()

      return result.map((row) => {
        const record = this.asRecord(row)
        return {
          id: this.coerceString(record.id),
          name: this.coerceString(record.name),
          checksum: this.coerceString(record.checksum),
          appliedAt: this.coerceDate(record.appliedAt),
          executionTime: this.coerceNumber(record.executionTime),
          success: this.coerceBoolean(record.success),
        }
      })
    } catch (error) {
      throw new Error(`Failed to get migration history: ${error instanceof Error ? error.message : String(error)}`)
    }
  }

  async validate(kyselyInstance: AnyKyselyDatabase, schemaPath: string): Promise<boolean> {
    try {
      const diff = await this.diff(kyselyInstance, schemaPath)
      return diff.statements.length === 0
    } catch (error) {
      throw new Error(`Failed to validate schema: ${error instanceof Error ? error.message : String(error)}`)
    }
  }

  /**
   * Get enhanced migration history with rollback information
   */
  async getEnhancedHistory(kyselyInstance: AnyKyselyDatabase): Promise<EnhancedMigrationHistoryEntry[]> {
    try {
      await this.ensureMigrationTableExists(kyselyInstance)

      const result = await kyselyInstance
        .selectFrom(this.options.migrationTableName)
        .selectAll()
        .orderBy('appliedAt', 'desc')
        .execute()

      return result.map((row) => {
        const record = this.asRecord(row)
        const statements = this.parseJsonStringArray(record['statements'])
        const dependencies = this.parseJsonStringArray(record['dependencies'])
        const rollbackStatements = this.parseJsonStringArray(record['rollbackStatements'])
        const rollbackWarnings = this.parseJsonStringArray(record['rollbackWarnings'])

        const schemaVersion = this.optionalString(record['schemaVersion'])

        return {
          id: this.coerceString(record.id),
          name: this.coerceString(record.name),
          checksum: this.coerceString(record.checksum),
          appliedAt: this.coerceDate(record.appliedAt),
          executionTime: this.coerceNumber(record.executionTime),
          success: this.coerceBoolean(record.success),
          statements,
          dependencies,
          schemaVersion,
          rollback:
            rollbackStatements.length > 0 || rollbackWarnings.length > 0
              ? {
                  migrationId: this.coerceString(record['id']),
                  rollbackStatements,
                  rollbackChecksum: this.coerceString(record['rollbackChecksum']),
                  canRollback: this.coerceBoolean(record['canRollback']),
                  warnings: rollbackWarnings,
                }
              : undefined,
        }
      })
    } catch (error) {
      throw new Error(
        `Failed to get enhanced migration history: ${error instanceof Error ? error.message : String(error)}`,
      )
    }
  }

  /**
   * Acquire migration lock to prevent concurrent operations
   */
  async acquireMigrationLock(
    kyselyInstance: AnyKyselyDatabase,
    migrationId: string,
    timeoutMs: number = 30000,
  ): Promise<MigrationLock> {
    try {
      await this.ensureMigrationLockTableExists(kyselyInstance)

      const processId = `${process.pid}_${Date.now()}`
      const lockId = `lock_${migrationId}_${Date.now()}`
      const acquiredAt = new Date()
      const expiresAt = new Date(Date.now() + timeoutMs)

      // Clean up expired locks first
      await this.cleanupExpiredLocks(kyselyInstance)

      // Check for existing locks
      const existingLocks = await kyselyInstance
        .selectFrom('_ork_migration_locks')
        .selectAll()
        .where('migrationId', '=', migrationId)
        .execute()

      if (existingLocks.length > 0) {
        throw new Error(`Migration ${migrationId} is already locked by another process`)
      }

      // Acquire the lock
      await kyselyInstance
        .insertInto('_ork_migration_locks')
        .values({
          id: lockId,
          processId,
          acquiredAt: acquiredAt.toISOString(),
          expiresAt: expiresAt.toISOString(),
          migrationId,
        })
        .execute()

      return {
        id: lockId,
        processId,
        acquiredAt,
        expiresAt,
        migrationId,
      }
    } catch (error) {
      throw new Error(`Failed to acquire migration lock: ${error instanceof Error ? error.message : String(error)}`)
    }
  }

  /**
   * Release migration lock
   */
  async releaseMigrationLock(kyselyInstance: AnyKyselyDatabase, lock: MigrationLock): Promise<void> {
    try {
      // Check if the lock table exists before trying to delete
      const tables = await kyselyInstance.introspection.getTables()
      const lockTableExists = tables.some((t) => t.name === '_ork_migration_locks')

      if (!lockTableExists) {
        // Table doesn't exist, so the lock is already gone (or was never created)
        return
      }

      await kyselyInstance
        .deleteFrom('_ork_migration_locks')
        .where('id', '=', lock.id)
        .where('processId', '=', lock.processId)
        .execute()
    } catch (error) {
      // Silently handle errors during lock release - the lock will expire anyway
      // Don't log as it may cause confusion when the database connection is closing
    }
  }

  /**
   * Check if migration is currently locked
   */
  async isMigrationLocked(kyselyInstance: AnyKyselyDatabase, migrationId?: string): Promise<boolean> {
    try {
      await this.ensureMigrationLockTableExists(kyselyInstance)
      await this.cleanupExpiredLocks(kyselyInstance)

      let query = kyselyInstance.selectFrom('_ork_migration_locks').selectAll()

      if (migrationId) {
        query = query.where('migrationId', '=', migrationId)
      }

      const locks = await query.execute()
      return locks.length > 0
    } catch (error) {
      console.warn(`Failed to check migration lock: ${error instanceof Error ? error.message : String(error)}`)
      return false
    }
  }

  /**
   * Generate rollback statements for a migration
   */
  async generateRollback(kyselyInstance: AnyKyselyDatabase, migrationId: string): Promise<MigrationRollback> {
    try {
      const history = await this.getEnhancedHistory(kyselyInstance)
      const migration = history.find((m) => m.id === migrationId)

      if (!migration) {
        throw new Error(`Migration ${migrationId} not found in history`)
      }

      if (!migration.success) {
        throw new Error(`Cannot generate rollback for failed migration ${migrationId}`)
      }

      const rollbackStatements: string[] = []
      const warnings: string[] = []

      // Generate reverse operations for each statement
      for (const statement of [...migration.statements].reverse()) {
        const rollbackStatement = this.generateReverseStatement(kyselyInstance, statement)
        if (rollbackStatement) {
          rollbackStatements.push(rollbackStatement)
        } else {
          warnings.push(`Cannot generate rollback for statement: ${statement}`)
        }
      }

      const canRollback = rollbackStatements.length > 0 && warnings.length === 0
      const rollbackChecksum = this.generateChecksum(rollbackStatements.join('\n'))

      return {
        migrationId,
        rollbackStatements,
        rollbackChecksum,
        canRollback,
        warnings,
      }
    } catch (error) {
      throw new Error(`Failed to generate rollback: ${error instanceof Error ? error.message : String(error)}`)
    }
  }

  /**
   * Execute rollback for a migration
   */
  async rollback(kyselyInstance: AnyKyselyDatabase, migrationId: string): Promise<MigrationResult> {
    const startTime = Date.now()
    let lock: MigrationLock | null = null

    try {
      // Acquire lock for rollback operation
      lock = await this.acquireMigrationLock(kyselyInstance, `rollback_${migrationId}`)

      const rollbackInfo = await this.generateRollback(kyselyInstance, migrationId)

      if (!rollbackInfo.canRollback) {
        throw new Error(`Cannot rollback migration ${migrationId}: ${rollbackInfo.warnings.join(', ')}`)
      }

      const rollbackDiff: MigrationDiff = {
        statements: rollbackInfo.rollbackStatements,
        summary: {
          tablesCreated: [],
          tablesModified: [],
          tablesDropped: [],
          columnsAdded: [],
          columnsModified: [],
          columnsDropped: [],
          indexesCreated: [],
          indexesDropped: [],
          foreignKeysCreated: [],
          foreignKeysDropped: [],
          enumsCreated: [],
          enumsModified: [],
          enumsDropped: [],
        },
        hasDestructiveChanges: true,
        impact: {
          riskLevel: 'high',
          estimatedDuration: this.estimateMigrationDuration(rollbackInfo.rollbackStatements.length, true),
          warnings: rollbackInfo.warnings,
          tablesAffected: [],
        },
      }

      const result = this.options.useTransaction
        ? await this.executeInTransaction(kyselyInstance, rollbackDiff)
        : await this.executeStatements(kyselyInstance, rollbackDiff)

      if (result.success) {
        // Record the rollback in history
        await this.recordRollback(kyselyInstance, migrationId, rollbackInfo, result.executionTime)

        // Remove the original migration from history
        await this.removeMigrationFromHistory(kyselyInstance, migrationId)
      }

      return {
        ...result,
        executionTime: Date.now() - startTime,
      }
    } catch (error) {
      return {
        success: false,
        statementsExecuted: 0,
        executionTime: Date.now() - startTime,
        errors: [
          {
            message: error instanceof Error ? error.message : String(error),
            stack: error instanceof Error ? error.stack : undefined,
          },
        ],
      }
    } finally {
      if (lock) {
        await this.releaseMigrationLock(kyselyInstance, lock)
      }
    }
  }

  /**
   * Validate migration integrity
   */
  async validateMigrationIntegrity(kyselyInstance: AnyKyselyDatabase): Promise<MigrationValidation> {
    try {
      const history = await this.getHistory(kyselyInstance)
      const errors: string[] = []
      const warnings: string[] = []

      // Check for duplicate migration IDs
      const ids = new Set<string>()
      for (const migration of history) {
        if (ids.has(migration.id)) {
          errors.push(`Duplicate migration ID found: ${migration.id}`)
        }
        ids.add(migration.id)
      }

      // Check for checksum consistency
      let checksumValid = true
      for (const migration of history) {
        if (!migration.checksum || migration.checksum.length === 0) {
          errors.push(`Missing checksum for migration: ${migration.id}`)
          checksumValid = false
        }
      }

      // Check for failed migrations
      const failedMigrations = history.filter((m) => !m.success)
      if (failedMigrations.length > 0) {
        warnings.push(`Found ${failedMigrations.length} failed migrations`)
      }

      // Validate current schema state
      let schemaIntegrityValid = true
      try {
        await this.introspectDatabase(kyselyInstance)
      } catch (error) {
        errors.push(`Schema introspection failed: ${error instanceof Error ? error.message : String(error)}`)
        schemaIntegrityValid = false
      }

      return {
        isValid: errors.length === 0,
        errors,
        warnings,
        checksumValid,
        schemaIntegrityValid,
      }
    } catch (error) {
      return {
        isValid: false,
        errors: [`Validation failed: ${error instanceof Error ? error.message : String(error)}`],
        warnings: [],
        checksumValid: false,
        schemaIntegrityValid: false,
      }
    }
  }

  /**
   * Generate detailed migration preview with human-readable summary
   */
  async generateMigrationPreview(kyselyInstance: AnyKyselyDatabase, schemaPath: string): Promise<MigrationPreview> {
    try {
      const migrationDiff = await this.diff(kyselyInstance, schemaPath)
      const detailedSummary = await this.generateDetailedSummary(kyselyInstance, migrationDiff)
      const riskAssessment = this.assessMigrationRisk(kyselyInstance, migrationDiff, detailedSummary)
      const rollbackInfo = await this.generateRollbackPreview(kyselyInstance, migrationDiff.statements)

      const description = this.generateHumanReadableDescription(detailedSummary)

      return {
        summary: detailedSummary,
        statements: migrationDiff.statements,
        description,
        riskAssessment,
        rollbackInfo,
      }
    } catch (error) {
      throw new Error(`Failed to generate migration preview: ${error instanceof Error ? error.message : String(error)}`)
    }
  }

  /**
   * Apply migration with interactive confirmation and progress reporting
   */
  async applyWithConfirmation(
    kyselyInstance: AnyKyselyDatabase,
    schemaPath: string,
    promptConfig: MigrationPromptConfig = {
      enabled: true,
      minimumRiskLevel: 'medium',
      showDetailedSummary: true,
      requireExplicitConfirmation: true,
    },
    loggingConfig: MigrationLoggingConfig = {
      level: 'info',
      logStatements: true,
      logExecutionTimes: true,
      logProgress: true,
    },
  ): Promise<MigrationResult> {
    const startTime = Date.now()
    let lock: MigrationLock | null = null

    try {
      // Generate preview
      const preview = await this.generateMigrationPreview(kyselyInstance, schemaPath)

      this.log(loggingConfig, 'info', 'Migration preview generated', {
        totalOperations: preview.summary.totalOperations,
        riskLevel: preview.riskAssessment.level,
      })

      // Show preview if enabled
      if (promptConfig.showDetailedSummary) {
        this.displayMigrationPreview(preview, loggingConfig)
      }

      // Check if confirmation is needed
      const needsConfirmation = this.shouldPromptForConfirmation(preview, promptConfig)

      if (needsConfirmation && promptConfig.enabled) {
        const confirmed = this.promptForConfirmation(preview, promptConfig, loggingConfig)
        if (!confirmed) {
          this.log(loggingConfig, 'info', 'Migration cancelled by user')
          return {
            success: false,
            statementsExecuted: 0,
            executionTime: Date.now() - startTime,
            errors: [{ message: 'Migration cancelled by user' }],
          }
        }
      }

      // Check if another migration is already running
      if (await this.isMigrationLocked(kyselyInstance)) {
        throw new Error('Another migration is currently in progress')
      }

      if (preview.statements.length === 0) {
        this.log(loggingConfig, 'info', 'No migration changes detected')
        return {
          success: true,
          statementsExecuted: 0,
          executionTime: Date.now() - startTime,
          errors: [],
        }
      }

      // Acquire lock for this migration
      const migrationId = `migration_${Date.now()}`
      lock = await this.acquireMigrationLock(kyselyInstance, migrationId)

      this.log(loggingConfig, 'info', 'Starting migration execution', {
        migrationId,
        totalStatements: preview.statements.length,
      })

      // Execute with progress reporting
      const migrationDiff: MigrationDiff = {
        statements: preview.statements,
        summary: preview.summary,
        hasDestructiveChanges: preview.riskAssessment.level === 'high',
        impact: {
          riskLevel: preview.riskAssessment.level,
          estimatedDuration: this.estimateMigrationDuration(
            preview.statements.length,
            preview.riskAssessment.level === 'high',
          ),
          warnings: preview.riskAssessment.factors,
          tablesAffected: preview.summary.tablesModified.concat(
            preview.summary.tablesCreated,
            preview.summary.tablesDropped,
          ),
        },
      }

      const result = this.options.useTransaction
        ? await this.executeInTransactionWithProgress(kyselyInstance, migrationDiff, loggingConfig)
        : await this.executeStatementsWithProgress(kyselyInstance, migrationDiff, loggingConfig)

      if (result.success) {
        await this.recordMigration(kyselyInstance, migrationDiff, result.executionTime)
        this.log(loggingConfig, 'info', 'Migration completed successfully', {
          statementsExecuted: result.statementsExecuted,
          executionTime: result.executionTime,
        })
      } else {
        this.log(loggingConfig, 'error', 'Migration failed', { errors: result.errors })
      }

      return {
        ...result,
        executionTime: Date.now() - startTime,
      }
    } catch (error) {
      this.log(loggingConfig, 'error', 'Migration error', {
        error: error instanceof Error ? error.message : String(error),
      })
      return {
        success: false,
        statementsExecuted: 0,
        executionTime: Date.now() - startTime,
        errors: [
          {
            message: error instanceof Error ? error.message : String(error),
            stack: error instanceof Error ? error.stack : undefined,
          },
        ],
      }
    } finally {
      if (lock) {
        await this.releaseMigrationLock(kyselyInstance, lock)
      }
    }
  }

  /**
   * Generate warnings for common migration pitfalls using Kysely introspection
   */
  async generateMigrationWarnings(kyselyInstance: AnyKyselyDatabase, migrationDiff: MigrationDiff): Promise<string[]> {
    const warnings: string[] = []

    try {
      const currentSchema = await this.introspectDatabase(kyselyInstance)

      // Check for potentially slow operations
      for (const statement of migrationDiff.statements) {
        const normalizedStatement = statement.trim().toUpperCase()

        // Large table modifications
        if (normalizedStatement.includes('ALTER TABLE')) {
          const tableNameMatch = statement.match(/ALTER TABLE\s+(\w+)/i)
          if (tableNameMatch) {
            const tableName = tableNameMatch[1]
            const table = currentSchema.tables.find((t) => t.name === tableName)
            if (table && table.columns.length > 20) {
              warnings.push(`Altering table '${tableName}' with ${table.columns.length} columns may be slow`)
            }
          }
        }

        // Adding NOT NULL columns without defaults
        if (
          normalizedStatement.includes('ADD COLUMN') &&
          normalizedStatement.includes('NOT NULL') &&
          !normalizedStatement.includes('DEFAULT')
        ) {
          warnings.push('Adding NOT NULL column without default value may fail if table contains data')
        }

        // Dropping columns with potential foreign key references
        if (normalizedStatement.includes('DROP COLUMN')) {
          const match = statement.match(/ALTER TABLE\s+(\w+)\s+DROP COLUMN\s+(\w+)/i)
          if (match) {
            const [, tableName, columnName] = match
            const table = currentSchema.tables.find((t) => t.name === tableName)
            if (table) {
              const hasReferences = table.foreignKeys.some((fk) => fk.columns.includes(columnName))
              if (hasReferences) {
                warnings.push(
                  `Dropping column '${columnName}' from '${tableName}' may affect foreign key relationships`,
                )
              }
            }
          }
        }

        // Creating indexes on large tables
        if (normalizedStatement.includes('CREATE INDEX')) {
          const tableMatch = statement.match(/ON\s+(\w+)/i)
          if (tableMatch) {
            const tableName = tableMatch[1]
            warnings.push(`Creating index on table '${tableName}' may take significant time if table is large`)
          }
        }

        // Renaming tables or columns
        if (normalizedStatement.includes('RENAME')) {
          warnings.push('Rename operations may break application code that references the old names')
        }
      }

      // Check for cascade effects
      const tablesBeingDropped = migrationDiff.summary.tablesDropped
      for (const droppedTable of tablesBeingDropped) {
        const dependentTables = currentSchema.tables.filter((table) =>
          table.foreignKeys.some((fk) => fk.referencedTable === droppedTable),
        )
        if (dependentTables.length > 0) {
          warnings.push(
            `Dropping table '${droppedTable}' will affect ${
              dependentTables.length
            } dependent table(s): ${dependentTables.map((t) => t.name).join(', ')}`,
          )
        }
      }

      // Check for potential data type conversion issues
      for (const columnChange of migrationDiff.summary.columnsModified) {
        if (columnChange.change && columnChange.change.includes('type:')) {
          warnings.push(
            `Type change for column '${columnChange.column}' in table '${columnChange.table}' may cause data conversion issues`,
          )
        }
      }
    } catch (error) {
      warnings.push(`Unable to generate complete warnings: ${error instanceof Error ? error.message : String(error)}`)
    }

    return warnings
  }

  private parseSchema(schemaPath: string): SchemaAST {
    const parseResult = parseSchema(schemaPath)

    if (parseResult.errors.length > 0) {
      const errorMessages = parseResult.errors.map((err) => err.message).join(', ')
      throw new Error(`Schema parsing failed: ${errorMessages}`)
    }

    return parseResult.ast
  }

  private async introspectDatabase(kyselyInstance: AnyKyselyDatabase): Promise<DatabaseSchema> {
    try {
      const introspector = kyselyInstance.introspection

      const tableMetadata = await introspector.getTables()
      const visibleTables = tableMetadata.filter((table) => !INTERNAL_MIGRATION_TABLES.has(table.name))
      const sqliteCapabilities = await this.getSqliteCapabilities(kyselyInstance)
      const isSqlite = sqliteCapabilities !== null

      const databaseTables = await Promise.all(
        visibleTables.map(async (table) => {
          const columns = isSqlite
            ? await this.getSqliteColumns(kyselyInstance, table.name)
            : table.columns.map((col) => ({
                name: col.name,
                type: col.dataType,
                nullable: col.isNullable,
                defaultValue: col.hasDefaultValue ? 'DEFAULT' : undefined,
                autoIncrement: col.isAutoIncrementing,
                comment: col.comment,
              }))

          const additionalConstraints = isSqlite
            ? await this.getSqliteConstraints(kyselyInstance, table.name)
            : await this.getAdditionalConstraints(kyselyInstance, table.name)

          return {
            name: table.name,
            schema: table.schema,
            isView: table.isView,
            columns,
            primaryKey: additionalConstraints.primaryKey,
            foreignKeys: additionalConstraints.foreignKeys,
            uniqueConstraints: additionalConstraints.uniqueConstraints,
            indexes: additionalConstraints.indexes,
          }
        }),
      )

      const tables = databaseTables.filter((t) => !t.isView)
      const views = databaseTables
        .filter((t) => t.isView)
        .map((v) => ({
          name: v.name,
          definition: 'VIEW',
        }))

      return {
        tables: tables.map((t) => ({
          name: t.name,
          columns: t.columns,
          primaryKey: t.primaryKey,
          foreignKeys: t.foreignKeys,
          uniqueConstraints: t.uniqueConstraints,
          indexes: t.indexes,
        })),
        views,
        indexes: [], // TODO: Implement global index introspection
        enums: [], // TODO: Implement enum introspection when database supports it
      }
    } catch (error) {
      throw new Error(
        `Failed to introspect database using Kysely: ${error instanceof Error ? error.message : String(error)}`,
      )
    }
  }

  private async getAdditionalConstraints(
    kyselyInstance: AnyKyselyDatabase,
    tableName: string,
  ): Promise<{
    primaryKey: string[]
    foreignKeys: DatabaseForeignKey[]
    uniqueConstraints: DatabaseUniqueConstraint[]
    indexes: DatabaseIndex[]
  }> {
    try {
      // Use only Kysely's introspection API for database-agnostic constraint detection
      const tables = await kyselyInstance.introspection.getTables()
      const table = tables.find((t) => t.name === tableName)

      if (!table) {
        return {
          primaryKey: [],
          foreignKeys: [],
          uniqueConstraints: [],
          indexes: [],
        }
      }

      // Extract primary key columns from Kysely's table metadata
      const primaryKey = table.columns
        .filter((col) => col.isAutoIncrementing || col.name === 'id') // Simple heuristic for primary keys
        .map((col) => col.name)

      // Note: Kysely's introspection doesn't provide detailed constraint info for all databases
      // For now, return empty arrays for foreign keys and unique constraints
      // This is acceptable since the migration system can still generate CREATE/DROP TABLE statements
      const foreignKeys: DatabaseForeignKey[] = []
      const uniqueConstraints: DatabaseUniqueConstraint[] = []

      return {
        primaryKey,
        foreignKeys,
        uniqueConstraints,
        indexes: [], // TODO: Implement proper index introspection when Kysely supports it
      }
    } catch (error) {
      console.warn(`Could not retrieve constraint info for ${tableName}: ${error}`)
      return {
        primaryKey: [],
        foreignKeys: [],
        uniqueConstraints: [],
        indexes: [],
      }
    }
  }

  private generateDiff(
    kyselyInstance: AnyKyselyDatabase,
    currentSchema: DatabaseSchema,
    targetSchemaAST: SchemaAST,
    dialect: DatabaseDialect,
    sqliteCapabilities: SqliteCapabilities | null,
  ): MigrationDiff {
    const summary: MigrationSummary = {
      tablesCreated: [],
      tablesModified: [],
      tablesDropped: [],
      columnsAdded: [],
      columnsModified: [],
      columnsDropped: [],
      indexesCreated: [],
      indexesDropped: [],
      foreignKeysCreated: [],
      foreignKeysDropped: [],
      enumsCreated: [],
      enumsModified: [],
      enumsDropped: [],
    }

    const statements: string[] = []
    let hasDestructiveChanges = false
    const warnings: string[] = []
    const tablesAffected: string[] = []

    try {
      const currentTables = new Map(
        currentSchema.tables.filter((t) => !INTERNAL_MIGRATION_TABLES.has(t.name)).map((t) => [t.name, t]),
      )
      const targetModels = new Map(targetSchemaAST.models.map((m) => [m.name, m]))

      for (const [modelName, model] of targetModels) {
        if (!currentTables.has(modelName)) {
          summary.tablesCreated.push(modelName)
          tablesAffected.push(modelName)

          const createStatement = this.generateCreateTableStatement(kyselyInstance, model, dialect)
          statements.push(createStatement)

          for (const field of model.fields || []) {
            summary.columnsAdded.push({ table: modelName, column: field.name })
          }

          // Generate unique indexes for fields marked with @unique
          const uniqueFields = (model.fields || []).filter((f: FieldAST) =>
            f.attributes?.some((a: AttributeAST) => a.name === 'unique'),
          )
          for (const f of uniqueFields) {
            const idxName = this.generateIndexName(modelName, [f.name], true)
            const idxSql = this.generateCreateIndexSQL(idxName, modelName, [f.name], true, true, dialect)
            statements.push(idxSql)
            summary.indexesCreated.push(idxName)
          }
        }
      }

      for (const [tableName, table] of currentTables) {
        if (!targetModels.has(tableName)) {
          summary.tablesDropped.push(tableName)
          tablesAffected.push(tableName)
          hasDestructiveChanges = true
          warnings.push(`Dropping table '${tableName}' will permanently delete all data`)

          const dropStatement = this.generateDropTableStatement(kyselyInstance, tableName)
          statements.push(dropStatement)

          for (const column of table.columns) {
            summary.columnsDropped.push({ table: tableName, column: column.name })
          }
        }
      }

      for (const [tableName, currentTable] of currentTables) {
        const targetModel = targetModels.get(tableName)
        if (targetModel) {
          const tableDiff = this.compareTableStructure(
            kyselyInstance,
            currentTable,
            targetModel,
            dialect,
            sqliteCapabilities,
          )

          if (tableDiff.hasChanges) {
            summary.tablesModified.push(tableName)
            tablesAffected.push(tableName)

            summary.columnsAdded.push(...tableDiff.columnsAdded.map((col) => ({ table: tableName, column: col })))
            summary.columnsModified.push(
              ...tableDiff.columnsModified.map((col) => ({ table: tableName, column: col.name, change: col.change })),
            )
            summary.columnsDropped.push(...tableDiff.columnsDropped.map((col) => ({ table: tableName, column: col })))

            statements.push(...tableDiff.statements)

            if (tableDiff.columnsDropped.length > 0) {
              hasDestructiveChanges = true
              warnings.push(`Dropping columns from '${tableName}' will permanently delete data`)
            }

            if (tableDiff.columnsModified.some((c) => c.isDestructive)) {
              hasDestructiveChanges = true
              warnings.push(`Modifying columns in '${tableName}' may cause data loss`)
            }

            if (tableDiff.requiresTableRebuild) {
              warnings.push(`SQLite will rebuild table '${tableName}' to apply column changes`)
            }
          }

          if (dialect === 'sqlite') {
            const sqliteForeignKeys = this.extractForeignKeysFromModel(targetModel)
            if (sqliteForeignKeys.length > 0 && (tableDiff.hasChanges || summary.tablesCreated.includes(tableName))) {
              warnings.push(
                `SQLite does not support altering foreign keys; constraints for '${tableName}' are ignored in migrations`,
              )
            }
          } else {
            // Compare foreign keys for this table
            const foreignKeyDiff = this.compareForeignKeys(kyselyInstance, currentTable, targetModel)
            if (foreignKeyDiff.hasChanges) {
              statements.push(...foreignKeyDiff.statements)
              summary.foreignKeysCreated.push(...foreignKeyDiff.foreignKeysCreated)
              summary.foreignKeysDropped.push(...foreignKeyDiff.foreignKeysDropped)
              if (!summary.tablesModified.includes(tableName)) {
                summary.tablesModified.push(tableName)
              }
              if (!tablesAffected.includes(tableName)) {
                tablesAffected.push(tableName)
              }

              // Foreign key drops are potentially destructive
              if (foreignKeyDiff.foreignKeysDropped.length > 0) {
                hasDestructiveChanges = true
                warnings.push(`Dropping foreign key constraints from '${tableName}' may affect data integrity`)
              }
            }
          }

          if (!(dialect === 'sqlite' && tableDiff.requiresTableRebuild)) {
            // Compare indexes for this table (including unique, multi-column, and custom indexes)
            const indexDiff = this.compareIndexes(kyselyInstance, currentTable, targetModel, dialect)
            if (indexDiff.hasChanges) {
              statements.push(...indexDiff.statements)
              summary.indexesCreated.push(...indexDiff.indexesCreated)
              summary.indexesDropped.push(...indexDiff.indexesDropped)
              if (!summary.tablesModified.includes(tableName)) {
                summary.tablesModified.push(tableName)
              }
              if (!tablesAffected.includes(tableName)) {
                tablesAffected.push(tableName)
              }
            }
          }
        }
      }

      // Compare enums between current and target schema
      const enumDiff = this.compareEnums(kyselyInstance, currentSchema, targetSchemaAST)
      if (enumDiff.hasChanges) {
        statements.push(...enumDiff.statements)
        summary.enumsCreated.push(...enumDiff.enumsCreated)
        summary.enumsModified.push(...enumDiff.enumsModified)
        summary.enumsDropped.push(...enumDiff.enumsDropped)

        // Enum drops are potentially destructive
        if (enumDiff.enumsDropped.length > 0) {
          hasDestructiveChanges = true
          warnings.push(`Dropping enum types may cause data loss in columns using these enums`)
        }
      }

      const conflicts = this.detectMigrationConflicts(currentSchema, targetSchemaAST)
      warnings.push(...conflicts)

      if (conflicts.length > 0) {
        hasDestructiveChanges = true
      }

      const impact: MigrationImpact = {
        riskLevel: hasDestructiveChanges ? 'high' : summary.tablesModified.length > 0 ? 'medium' : 'low',
        estimatedDuration: this.estimateMigrationDuration(statements.length, hasDestructiveChanges),
        warnings,
        tablesAffected,
      }

      return {
        statements,
        summary,
        hasDestructiveChanges,
        impact,
      }
    } catch (error) {
      throw new Error(
        `Failed to generate migration diff using Kysely DDL builders: ${
          error instanceof Error ? error.message : String(error)
        }`,
      )
    }
  }

  private generateCreateTableStatement(
    kyselyInstance: AnyKyselyDatabase,
    model: ModelAST,
    dialect: DatabaseDialect,
    tableNameOverride?: string,
  ): string {
    try {
      const tableName = tableNameOverride ?? this.getTableName(model)
      let createTableBuilder = kyselyInstance.schema.createTable(tableName)

      // Only create columns for fields that should be in the database
      const databaseFields = model.fields.filter((field) => this.shouldCreateDatabaseColumn(field))

      for (const field of databaseFields) {
        const sqlType = this.mapFieldTypeToSQL(field, dialect)
        const isSerialType = sqlType.toLowerCase() === 'serial' || sqlType.toLowerCase() === 'bigserial'

        createTableBuilder = createTableBuilder.addColumn(field.name, sqlType, (col) => {
          // SERIAL types are implicitly NOT NULL, so don't add it
          if (!field.isOptional && !isSerialType) {
            col = col.notNull()
          }

          const isId = field.attributes?.some((attr) => attr.name === 'id')
          const hasAutoIncrement = field.attributes?.some(
            (attr) => attr.name === 'default' && attr.args?.[0]?.value === 'autoincrement()',
          )

          if (isId) {
            col = col.primaryKey()
            // For SQLite, integer primary key with autoincrement
            if (hasAutoIncrement && sqlType === 'integer') {
              // SQLite handles autoincrement automatically for INTEGER PRIMARY KEY
              // We don't need to set AUTOINCREMENT explicitly in most cases
            }
          }

          // SERIAL types have built-in defaults, so skip @default(autoincrement())
          if (field.attributes?.some((attr) => attr.name === 'default')) {
            const defaultAttr = field.attributes.find((attr) => attr.name === 'default')
            if (defaultAttr?.args?.[0]) {
              // Extract the actual value from the AttributeArgumentAST object
              const defaultValue = defaultAttr.args[0].value || defaultAttr.args[0]

              // Skip autoincrement for SERIAL types - they handle it internally
              if (isSerialType && defaultValue === 'autoincrement()') {
                return col
              }

              const formattedDefault = this.formatDefaultValue(defaultValue)
              if (formattedDefault !== null) {
                col = col.defaultTo(formattedDefault)
              }
            }
          }

          return col
        })
      }

      if (dialect === 'sqlite') {
        const foreignKeys = this.extractForeignKeysFromModel(model)
        for (const fk of foreignKeys) {
          createTableBuilder = createTableBuilder.addForeignKeyConstraint(
            fk.name,
            fk.columns,
            fk.referencedTable,
            fk.referencedColumns,
            (constraint) => {
              let builder = constraint
              if (fk.onDelete) {
                const normalizedAction = this.normalizeSqliteFkActionForBuilder(fk.onDelete)
                if (normalizedAction) {
                  builder = builder.onDelete(normalizedAction)
                }
              }
              if (fk.onUpdate) {
                const normalizedAction = this.normalizeSqliteFkActionForBuilder(fk.onUpdate)
                if (normalizedAction) {
                  builder = builder.onUpdate(normalizedAction)
                }
              }
              return builder
            },
          )
        }
      }

      const compiledQuery = createTableBuilder.compile()
      return compiledQuery.sql
    } catch (error) {
      throw new Error(
        `Failed to generate CREATE TABLE statement using Kysely DDL builders: ${
          error instanceof Error ? error.message : String(error)
        }`,
      )
    }
  }

  private generateDropTableStatement(kyselyInstance: AnyKyselyDatabase, tableName: string): string {
    try {
      const dropTableBuilder = kyselyInstance.schema.dropTable(tableName)

      const compiledQuery = dropTableBuilder.compile()
      return compiledQuery.sql
    } catch (error) {
      throw new Error(
        `Failed to generate DROP TABLE statement using Kysely DDL builders: ${
          error instanceof Error ? error.message : String(error)
        }`,
      )
    }
  }

  private generateCreateIndexStatement(
    kyselyInstance: AnyKyselyDatabase,
    indexName: string,
    tableName: string,
    columns: string[],
  ): string {
    try {
      let createIndexBuilder = kyselyInstance.schema.createIndex(indexName).on(tableName)

      for (const column of columns) {
        createIndexBuilder = createIndexBuilder.column(column)
      }

      const compiledQuery = createIndexBuilder.compile()
      return compiledQuery.sql
    } catch (error) {
      throw new Error(
        `Failed to generate CREATE INDEX statement using Kysely DDL builders: ${
          error instanceof Error ? error.message : String(error)
        }`,
      )
    }
  }

  private generateDropIndexStatement(kyselyInstance: AnyKyselyDatabase, indexName: string): string {
    try {
      const dropIndexBuilder = kyselyInstance.schema.dropIndex(indexName)

      const compiledQuery = dropIndexBuilder.compile()
      return compiledQuery.sql
    } catch (error) {
      throw new Error(
        `Failed to generate DROP INDEX statement using Kysely DDL builders: ${
          error instanceof Error ? error.message : String(error)
        }`,
      )
    }
  }

  /**
   * Deterministic index name generator
   */
  private generateIndexName(table: string, columns: string[], unique: boolean): string {
    const cols = columns.join('_')
    const prefix = unique ? 'uniq' : 'idx'
    return `${prefix}_${table}_${cols}`
  }

  /**
   * Generate CREATE INDEX SQL with optional UNIQUE and IF NOT EXISTS
   * Uses plain SQL for broad dialect compatibility.
   */
  private generateCreateIndexSQL(
    indexName: string,
    table: string,
    columns: string[],
    unique: boolean,
    ifNotExists = false,
    dialect?: DatabaseDialect,
  ): string {
    const uniqueSql = unique ? 'UNIQUE ' : ''
    const supportsIfNotExists = dialect !== 'mysql'
    const ifNotExistsSql = ifNotExists && supportsIfNotExists ? 'IF NOT EXISTS ' : ''
    const cols = columns.map((c) => `"${c}"`).join(', ')
    return `CREATE ${uniqueSql}INDEX ${ifNotExistsSql}"${indexName}" ON "${table}" (${cols})`
  }

  private compareTableStructure(
    kyselyInstance: AnyKyselyDatabase,
    currentTable: DatabaseTable,
    targetModel: ModelAST,
    dialect: DatabaseDialect,
    sqliteCapabilities: SqliteCapabilities | null,
  ): {
    hasChanges: boolean
    columnsAdded: string[]
    columnsModified: Array<{ name: string; change: string; isDestructive: boolean }>
    columnsDropped: string[]
    statements: string[]
    requiresTableRebuild: boolean
  } {
    const result = {
      hasChanges: false,
      columnsAdded: [] as string[],
      columnsModified: [] as Array<{ name: string; change: string; isDestructive: boolean }>,
      columnsDropped: [] as string[],
      statements: [] as string[],
      requiresTableRebuild: false,
    }

    try {
      const currentColumns = new Map(currentTable.columns.map((c) => [c.name, c]))
      const targetFields = new Map(
        targetModel.fields.filter((f) => this.shouldCreateDatabaseColumn(f)).map((f) => [f.name, f]),
      )
      const pendingStatements: string[] = []
      const isSqlite = dialect === 'sqlite'
      const supportsDropColumn = sqliteCapabilities?.supportsDropColumn ?? false
      const primaryKeyColumns = new Set(currentTable.primaryKey || [])

      for (const [fieldName, field] of targetFields) {
        if (!currentColumns.has(fieldName)) {
          result.hasChanges = true
          result.columnsAdded.push(fieldName)

          const sqlType = this.mapFieldTypeToSQL(field, dialect)

          const alterTableBuilder = kyselyInstance.schema
            .alterTable(currentTable.name)
            .addColumn(fieldName, sqlType, (col) => {
              if (!field.isOptional) {
                col = col.notNull()
              }

              if (field.attributes?.some((attr) => attr.name === 'default')) {
                const defaultAttr = field.attributes.find((attr) => attr.name === 'default')
                if (defaultAttr?.args?.[0]) {
                  // Extract the actual value from the AttributeArgumentAST object
                  const defaultValue = defaultAttr.args[0].value || defaultAttr.args[0]
                  col = col.defaultTo(this.formatDefaultValue(defaultValue))
                }
              }

              return col
            })

          const compiledQuery = alterTableBuilder.compile()
          pendingStatements.push(compiledQuery.sql)
        }
      }

      for (const [columnName] of currentColumns) {
        if (!targetFields.has(columnName)) {
          result.hasChanges = true
          result.columnsDropped.push(columnName)

          if (isSqlite && !supportsDropColumn) {
            result.requiresTableRebuild = true
          } else {
            const dropColumnBuilder = kyselyInstance.schema.alterTable(currentTable.name).dropColumn(columnName)
            const compiledQuery = dropColumnBuilder.compile()
            pendingStatements.push(compiledQuery.sql)
          }
        }
      }

      for (const [columnName, currentColumn] of currentColumns) {
        const targetField = targetFields.get(columnName)
        if (targetField) {
          const targetType = this.mapFieldTypeToSQL(targetField, dialect)
          const targetNullable = targetField.isOptional
          const normalizedCurrentType = isSqlite ? currentColumn.type.toLowerCase() : currentColumn.type
          const normalizedTargetType = isSqlite ? targetType.toLowerCase() : targetType
          const normalizedCurrentNullable =
            isSqlite && primaryKeyColumns.has(columnName) ? false : currentColumn.nullable

          if (normalizedCurrentType !== normalizedTargetType) {
            result.hasChanges = true
            result.columnsModified.push({
              name: columnName,
              change: `type: ${currentColumn.type} → ${targetType}`,
              isDestructive: this.isTypeChangeDestructive(currentColumn.type, targetType),
            })

            if (isSqlite) {
              result.requiresTableRebuild = true
            } else {
              const alterColumnBuilder = kyselyInstance.schema
                .alterTable(currentTable.name)
                .alterColumn(columnName, (col) => col.setDataType(targetType))
              const compiledQuery = alterColumnBuilder.compile()
              pendingStatements.push(compiledQuery.sql)
            }
          }

          if (normalizedCurrentNullable !== targetNullable) {
            result.hasChanges = true
            result.columnsModified.push({
              name: columnName,
              change: `nullable: ${normalizedCurrentNullable} → ${targetNullable}`,
              isDestructive: !targetNullable && normalizedCurrentNullable,
            })

            if (isSqlite) {
              result.requiresTableRebuild = true
            } else {
              const alterColumnBuilder = kyselyInstance.schema
                .alterTable(currentTable.name)
                .alterColumn(columnName, (col) => {
                  return targetNullable ? col.dropNotNull() : col.setNotNull()
                })
              const compiledQuery = alterColumnBuilder.compile()
              pendingStatements.push(compiledQuery.sql)
            }
          }

          // Compare default values
          const currentDefault = this.normalizeDefaultValue(currentColumn.defaultValue)
          const targetDefault = this.extractDefaultValueFromField(targetField)
          const normalizedTargetDefault = this.normalizeDefaultValue(targetDefault)

          if (isSqlite) {
            continue
          }

          if (currentDefault !== normalizedTargetDefault) {
            result.hasChanges = true
            const changeDescription = this.describeDefaultChange(currentDefault, normalizedTargetDefault)
            result.columnsModified.push({
              name: columnName,
              change: changeDescription,
              isDestructive: false, // Default changes are generally not destructive
            })

            if (isSqlite) {
              result.requiresTableRebuild = true
            } else {
              // Generate ALTER statement for default value change
              if (normalizedTargetDefault === null) {
                // Remove default
                pendingStatements.push(`ALTER TABLE "${currentTable.name}" ALTER COLUMN "${columnName}" DROP DEFAULT`)
              } else {
                // Set new default
                const defaultSQL = this.formatDefaultValueForSQL(targetDefault)
                pendingStatements.push(
                  `ALTER TABLE "${currentTable.name}" ALTER COLUMN "${columnName}" SET DEFAULT ${defaultSQL}`,
                )
              }
            }
          }
        }
      }

      if (result.requiresTableRebuild && isSqlite) {
        result.statements = this.buildSqliteTableRebuildStatements(kyselyInstance, currentTable, targetModel, dialect)
      } else {
        result.statements = pendingStatements
      }

      return result
    } catch (error) {
      throw new Error(
        `Failed to compare table structure using Kysely DDL builders: ${
          error instanceof Error ? error.message : String(error)
        }`,
      )
    }
  }

  /**
   * Determine if a field should create a database column
   * Excludes pure relation fields (like posts Post[], profile Profile?)
   * Includes scalar fields and foreign key fields (like userId Int)
   */
  private shouldCreateDatabaseColumn(field: FieldAST): boolean {
    // Check if it's a scalar/primitive type
    const primitiveTypes = ['String', 'Int', 'Boolean', 'DateTime', 'Float', 'Decimal', 'Json', 'Bytes', 'BigInt']
    if (primitiveTypes.includes(field.fieldType)) {
      return true
    }

    // If it has @relation attribute, it's a relation field - don't create column
    if (field.attributes?.some((attr) => attr.name === 'relation')) {
      return false
    }

    // If it's a list type (Post[]), it's a relation field - don't create column
    if (field.isList) {
      return false
    }

    // If it references another model but has no @relation, it might be a foreign key field
    // In Prisma, foreign key fields are typically named like userId, authorId, etc.
    // and they are scalar types that reference the ID of another model
    const referencesModel = !primitiveTypes.includes(field.fieldType)
    if (referencesModel && !field.isList && !field.isOptional) {
      // This is likely a foreign key field, but without @relation it should still be a column
      // However, in proper Prisma schemas, these would be Int/String types, not model types
      return false // For now, exclude model types without @relation
    }

    return false
  }

  /**
   * Format default values for SQL
   */
  private formatDefaultValue(value: unknown): DefaultValue | null {
    if (typeof value === 'string') {
      // Handle special Prisma functions (as parsed by schema parser)
      if (value === 'autoincrement()') {
        // For SQLite, we don't set a default - instead we rely on column being INTEGER PRIMARY KEY AUTOINCREMENT
        // This is handled in the column definition, not as a default value
        return null // Skip setting default, let the primaryKey + integer handle it
      }
      if (value === 'now()') {
        return sql.raw('CURRENT_TIMESTAMP')
      }
      if (value === 'cuid()') {
        return sql.raw('uuid()')
      }
      if (value === 'uuid()') {
        return sql.raw('uuid()')
      }
      // Handle boolean strings
      if (value === 'true') {
        return true
      }
      if (value === 'false') {
        return false
      }
      // Handle string literals with quotes
      if (value.startsWith('"') && value.endsWith('"')) {
        return value.slice(1, -1) // Remove quotes
      }
      if (value.startsWith("'") && value.endsWith("'")) {
        return value.slice(1, -1) // Remove quotes
      }
      // Handle hex color values and regular strings
      return value
    }

    if (typeof value === 'number' || typeof value === 'boolean') {
      return value
    }

    // Handle AttributeArgumentAST objects that weren't extracted properly
    if (typeof value === 'object' && value !== null) {
      const record = this.asRecord(value)
      if (record['type'] === 'AttributeArgument') {
        return this.formatDefaultValue(record['value'])
      }
    }

    // Fallback: convert to string and log warning
    console.warn(`Unexpected default value type for SQL: ${typeof value}, value:`, value)
    return String(value)
  }

  /**
   * Extract database dialect from schema AST
   */
  private getDialectFromSchema(schemaAST: SchemaAST): DatabaseDialect {
    const datasource = schemaAST.datasources?.[0]
    if (!datasource) {
      // Default to postgresql if no datasource specified
      return 'postgresql'
    }

    const provider = datasource.provider.toLowerCase()
    // Map Prisma provider names to field-translator dialects
    if (provider === 'postgresql' || provider === 'postgres') return 'postgresql'
    if (provider === 'mysql') return 'mysql'
    if (provider === 'sqlite') return 'sqlite'

    // Default to postgresql for unknown providers
    console.warn(`Unknown provider '${provider}', defaulting to postgresql`)
    return 'postgresql'
  }

  private async getSqliteCapabilities(kyselyInstance: AnyKyselyDatabase): Promise<SqliteCapabilities | null> {
    try {
      const result = await sql<{ version: string }>`select sqlite_version() as version`.execute(kyselyInstance)
      const version = result.rows?.[0]?.version || '0.0.0'
      if (version === '0.0.0') {
        return null
      }
      const supportsRenameColumn = this.isSqliteVersionAtLeast(version, 3, 25, 0)
      const supportsDropColumn = this.isSqliteVersionAtLeast(version, 3, 35, 0)
      return {
        version,
        supportsRenameColumn,
        supportsDropColumn,
      }
    } catch (error) {
      return null
    }
  }

  private isSqliteVersionAtLeast(version: string, major: number, minor: number, patch: number): boolean {
    const [vMajor, vMinor, vPatch] = version
      .split('.')
      .slice(0, 3)
      .map((part) => Number.parseInt(part, 10))
      .map((value) => (Number.isFinite(value) ? value : 0))
    if (vMajor !== major) {
      return vMajor > major
    }
    if (vMinor !== minor) {
      return vMinor > minor
    }
    return vPatch >= patch
  }

  private buildSqliteTableRebuildStatements(
    kyselyInstance: AnyKyselyDatabase,
    currentTable: DatabaseTable,
    targetModel: ModelAST,
    dialect: DatabaseDialect,
  ): string[] {
    const tableName = currentTable.name
    const tempTableName = `_ork_tmp_${tableName}_${Date.now()}`
    const statements: string[] = []

    statements.push(this.generateCreateTableStatement(kyselyInstance, targetModel, dialect, tempTableName))

    const currentColumns = new Set(currentTable.columns.map((col) => col.name))
    const targetColumns = targetModel.fields
      .filter((field) => this.shouldCreateDatabaseColumn(field))
      .map((field) => field.name)
    const columnsToCopy = targetColumns.filter((column) => currentColumns.has(column))

    if (columnsToCopy.length > 0) {
      const quotedColumns = columnsToCopy.map((column) => `"${column}"`).join(', ')
      statements.push(`INSERT INTO "${tempTableName}" (${quotedColumns}) SELECT ${quotedColumns} FROM "${tableName}"`)
    }

    statements.push(`DROP TABLE "${tableName}"`)
    statements.push(`ALTER TABLE "${tempTableName}" RENAME TO "${tableName}"`)

    const targetIndexes = this.extractIndexesFromModel(targetModel)
    for (const index of targetIndexes) {
      statements.push(this.generateCreateIndexSQL(index.name, tableName, index.columns, index.unique, true, dialect))
    }

    return statements
  }

  private async getSqliteColumns(kyselyInstance: AnyKyselyDatabase, tableName: string): Promise<DatabaseColumn[]> {
    const pragmaTable = this.quoteSqliteIdentifier(tableName)
    const rows = await this.querySqlitePragma<{
      name: string
      type: string
      notnull: number
      dflt_value: unknown
      pk: number
    }>(kyselyInstance, `PRAGMA table_info("${pragmaTable}")`)

    return rows.map((row) => ({
      name: row.name,
      type: row.type,
      nullable: row.notnull === 0,
      defaultValue: row.dflt_value,
      autoIncrement: false,
    }))
  }

  private async getSqliteConstraints(
    kyselyInstance: AnyKyselyDatabase,
    tableName: string,
  ): Promise<{
    primaryKey: string[]
    foreignKeys: DatabaseForeignKey[]
    uniqueConstraints: DatabaseUniqueConstraint[]
    indexes: DatabaseIndex[]
  }> {
    const pragmaTable = this.quoteSqliteIdentifier(tableName)
    const tableInfo = await this.querySqlitePragma<{ name: string; pk: number }>(
      kyselyInstance,
      `PRAGMA table_info("${pragmaTable}")`,
    )
    const primaryKey = tableInfo
      .filter((col) => col.pk > 0)
      .sort((a, b) => a.pk - b.pk)
      .map((col) => col.name)

    const indexList = await this.querySqlitePragma<{
      name: string
      unique: number
      origin: string
    }>(kyselyInstance, `PRAGMA index_list("${pragmaTable}")`)

    const indexes: DatabaseIndex[] = []
    const uniqueConstraints: DatabaseUniqueConstraint[] = []

    for (const index of indexList) {
      if (index.origin === 'pk') {
        continue
      }

      if (index.origin !== 'c' && index.origin !== 'u') {
        continue
      }

      const indexName = index.name
      const pragmaIndex = this.quoteSqliteIdentifier(indexName)
      const indexInfo = await this.querySqlitePragma<{ name: string; seqno: number }>(
        kyselyInstance,
        `PRAGMA index_info("${pragmaIndex}")`,
      )
      const columns = indexInfo.sort((a, b) => a.seqno - b.seqno).map((col) => col.name)

      const entry: DatabaseIndex = {
        name: indexName,
        tableName,
        columns,
        unique: index.unique === 1,
      }
      indexes.push(entry)

      if (entry.unique) {
        uniqueConstraints.push({
          name: entry.name,
          columns: entry.columns,
        })
      }
    }

    const foreignKeyRows = await this.querySqlitePragma<{
      id: number
      seq: number
      table: string
      from: string
      to: string
      on_update: string
      on_delete: string
    }>(kyselyInstance, `PRAGMA foreign_key_list("${pragmaTable}")`)

    const foreignKeys: DatabaseForeignKey[] = []
    const grouped = new Map<number, typeof foreignKeyRows>()
    for (const row of foreignKeyRows) {
      const existing = grouped.get(row.id)
      if (existing) {
        existing.push(row)
      } else {
        grouped.set(row.id, [row])
      }
    }

    for (const rows of grouped.values()) {
      const ordered = rows.sort((a, b) => a.seq - b.seq)
      const referencedTable = ordered[0]?.table ?? ''
      const columns = ordered.map((row) => row.from)
      const referencedColumns = ordered.map((row) => row.to)
      const constraintName = `fk_${tableName}_${columns.join('_')}_${referencedTable}`
      foreignKeys.push({
        name: constraintName,
        columns,
        referencedTable,
        referencedColumns,
        onDelete: this.normalizeSqliteFkAction(ordered[0]?.on_delete),
        onUpdate: this.normalizeSqliteFkAction(ordered[0]?.on_update),
      })
    }

    return {
      primaryKey,
      foreignKeys,
      uniqueConstraints,
      indexes,
    }
  }

  private normalizeSqliteFkAction(action?: string): DatabaseForeignKey['onDelete'] {
    if (!action) return undefined
    const normalized = action.toUpperCase()
    if (
      normalized === 'CASCADE' ||
      normalized === 'SET NULL' ||
      normalized === 'RESTRICT' ||
      normalized === 'NO ACTION'
    ) {
      return normalized
    }
    return undefined
  }

  private normalizeSqliteFkActionForBuilder(
    action: DatabaseForeignKey['onDelete'],
  ): 'no action' | 'restrict' | 'cascade' | 'set null' | 'set default' | undefined {
    if (!action) return undefined
    const normalized = action.toLowerCase()
    if (
      normalized === 'no action' ||
      normalized === 'restrict' ||
      normalized === 'cascade' ||
      normalized === 'set null' ||
      normalized === 'set default'
    ) {
      return normalized
    }
    return undefined
  }

  private quoteSqliteIdentifier(identifier: string): string {
    return identifier.replace(/"/g, '""')
  }

  private async querySqlitePragma<T extends Record<string, unknown>>(
    kyselyInstance: AnyKyselyDatabase,
    statement: string,
  ): Promise<T[]> {
    const result = await sql.raw(statement).execute(kyselyInstance)
    const rows = Array.isArray(result.rows) ? result.rows : []
    return rows.filter((row): row is T => typeof row === 'object' && row !== null)
  }

  private mapFieldTypeToSQL(field: FieldAST, dialect: DatabaseDialect): string {
    try {
      // Get the appropriate generator for this dialect
      const generator = transformationRegistry.getGenerator(dialect)
      if (generator) {
        const type = generator.getDatabaseColumnType(field)
        // Kysely's SQLite schema builder expects lowercase type keywords.
        if (dialect === 'sqlite') {
          return type.toLowerCase()
        }
        return type
      }
    } catch (error) {
      // Fall back to basic type mapping if field-translator fails
      console.warn(`Failed to use field-translator for ${field.name}, falling back to basic type mapping:`, error)
    }

    // Fallback type mapping (should rarely be used)
    const typeMap: Record<string, string> = {
      String: 'text',
      Int: 'integer',
      Boolean: 'boolean',
      DateTime: 'timestamp',
      Float: 'real',
      Decimal: 'decimal',
      Json: 'json',
      Bytes: 'blob',
      BigInt: 'bigint',
    }

    return typeMap[field.fieldType] || 'text'
  }

  private isTypeChangeDestructive(fromType: string, toType: string): boolean {
    const destructiveChanges = [
      ['TEXT', 'INTEGER'],
      ['TEXT', 'BOOLEAN'],
      ['INTEGER', 'BOOLEAN'],
      ['TIMESTAMP', 'INTEGER'],
      ['JSON', 'TEXT'],
    ]

    return destructiveChanges.some(
      ([from, to]) => fromType.toUpperCase().includes(from) && toType.toUpperCase().includes(to),
    )
  }

  private estimateMigrationDuration(statementCount: number, hasDestructiveChanges: boolean): string {
    if (statementCount === 0) return '< 1 second'
    if (statementCount <= 5 && !hasDestructiveChanges) return '< 5 seconds'
    if (statementCount <= 10) return '< 30 seconds'
    if (hasDestructiveChanges) return '1-5 minutes'
    return '< 1 minute'
  }

  private detectMigrationConflicts(currentSchema: DatabaseSchema, targetSchema: SchemaAST): string[] {
    const conflicts: string[] = []

    // Extract dialect for type mapping
    const dialect = this.getDialectFromSchema(targetSchema)

    const reservedKeywords = ['user', 'order', 'group', 'table', 'index', 'key', 'value', 'select', 'from', 'where']
    for (const model of targetSchema.models) {
      if (reservedKeywords.includes(model.name.toLowerCase())) {
        conflicts.push(`Table name '${model.name}' conflicts with SQL reserved keyword`)
      }
    }

    for (const model of targetSchema.models) {
      const columnNames = new Set<string>()
      for (const field of model.fields) {
        if (columnNames.has(field.name)) {
          conflicts.push(`Duplicate column name '${field.name}' in table '${model.name}'`)
        }
        columnNames.add(field.name)
      }
    }

    for (const model of targetSchema.models) {
      for (const field of model.fields) {
        if (this.isRelationField(field)) {
          const referencedModel = this.extractReferencedModel(field)
          if (referencedModel && !targetSchema.models.some((m) => m.name === referencedModel)) {
            conflicts.push(
              `Field '${field.name}' in table '${model.name}' references non-existent table '${referencedModel}'`,
            )
          }
        }
      }
    }

    const circularRefs = this.detectCircularReferences(targetSchema.models)
    conflicts.push(...circularRefs)

    const currentTables = new Map(currentSchema.tables.map((t) => [t.name, t]))
    for (const model of targetSchema.models) {
      const currentTable = currentTables.get(model.name)
      if (currentTable) {
        const typeConflicts = this.detectTypeConflicts(currentTable, model, dialect)
        conflicts.push(...typeConflicts)
      }
    }

    return conflicts
  }

  private isRelationField(field: FieldAST): boolean {
    const primitiveTypes = ['String', 'Int', 'Boolean', 'DateTime', 'Float', 'Decimal', 'Json', 'Bytes', 'BigInt']

    // If it's a primitive type, it's not a relation
    if (primitiveTypes.includes(field.fieldType)) {
      return false
    }

    // If it's a list type or has @relation, it's a relation
    if (field.isList || field.attributes?.some((attr) => attr.name === 'relation')) {
      return true
    }

    // If it references a model type, it's likely a relation
    return !primitiveTypes.includes(field.fieldType)
  }

  private extractReferencedModel(field: FieldAST): string | null {
    if (this.isRelationField(field)) {
      return field.fieldType
    }
    return null
  }

  private detectCircularReferences(models: ModelAST[]): string[] {
    const conflicts: string[] = []
    const visited = new Set<string>()
    const recursionStack = new Set<string>()
    const modelMap = new Map(models.map((model) => [model.name, model]))

    const isDirectBackReference = (currentModel: string, referencedModel: string, path: string[]): boolean => {
      const parent = path[path.length - 1]
      if (!parent || parent !== referencedModel) {
        return false
      }

      const parentModel = modelMap.get(parent)
      if (!parentModel) {
        return false
      }

      return parentModel.fields.some(
        (field) => this.isRelationField(field) && this.extractReferencedModel(field) === currentModel,
      )
    }

    const detectCycle = (modelName: string, path: string[]): boolean => {
      if (recursionStack.has(modelName)) {
        const cyclePath = [...path, modelName].join(' -> ')
        conflicts.push(`Circular reference detected: ${cyclePath}`)
        return true
      }

      if (visited.has(modelName)) {
        return false
      }

      visited.add(modelName)
      recursionStack.add(modelName)

      const model = modelMap.get(modelName)
      if (model) {
        for (const field of model.fields) {
          if (this.isRelationField(field)) {
            const referencedModel = this.extractReferencedModel(field)
            if (
              referencedModel &&
              !isDirectBackReference(modelName, referencedModel, path) &&
              detectCycle(referencedModel, [...path, modelName])
            ) {
              return true
            }
          }
        }
      }

      recursionStack.delete(modelName)
      return false
    }

    for (const model of models) {
      if (!visited.has(model.name)) {
        detectCycle(model.name, [])
      }
    }

    return conflicts
  }

  private detectTypeConflicts(currentTable: DatabaseTable, targetModel: ModelAST, dialect: DatabaseDialect): string[] {
    const conflicts: string[] = []
    const currentColumns = new Map(currentTable.columns.map((c) => [c.name, c]))

    // Only check fields that should be database columns
    for (const field of targetModel.fields.filter((f) => this.shouldCreateDatabaseColumn(f))) {
      const currentColumn = currentColumns.get(field.name)
      if (currentColumn) {
        const targetSqlType = this.mapFieldTypeToSQL(field, dialect)

        if (!this.areTypesCompatible(currentColumn.type, targetSqlType)) {
          conflicts.push(
            `Incompatible type change for column '${field.name}' in table '${targetModel.name}': ` +
              `${currentColumn.type} cannot be safely converted to ${targetSqlType}`,
          )
        }

        if (!field.isOptional && currentColumn.nullable) {
          conflicts.push(
            `Cannot make column '${field.name}' in table '${targetModel.name}' NOT NULL: ` +
              `existing data may contain NULL values`,
          )
        }
      }
    }

    return conflicts
  }

  /**
   * Get table name for a model, respecting @@map directive
   */
  private getTableName(model: { name: string; attributes?: AttributeAST[] }): string {
    // Check for @@map attribute
    const mapAttribute = model.attributes?.find((attr: AttributeAST) => attr.name === 'map')
    if (mapAttribute?.args?.[0]) {
      const mappedName = mapAttribute.args[0].value
      // Remove quotes if present
      return typeof mappedName === 'string' ? mappedName.replace(/^["']|["']$/g, '') : String(mappedName)
    }

    // Default: use model name as-is
    return model.name
  }

  private areTypesCompatible(fromType: string, toType: string): boolean {
    const normalizeType = (type: string) => type.toUpperCase().replace(/\(\d+\)/g, '')
    const from = normalizeType(fromType)
    const to = normalizeType(toType)

    if (from === to) return true

    const compatibleConversions = new Map([
      ['INTEGER', ['BIGINT', 'DECIMAL', 'REAL', 'TEXT']],
      ['BIGINT', ['DECIMAL', 'REAL', 'TEXT']],
      ['REAL', ['DECIMAL', 'TEXT']],
      ['DECIMAL', ['TEXT']],
      ['TEXT', ['VARCHAR', 'CHAR']],
      ['VARCHAR', ['TEXT', 'CHAR']],
      ['CHAR', ['VARCHAR', 'TEXT']],
      ['BOOLEAN', ['TEXT']],
      ['DATE', ['DATETIME', 'TIMESTAMP', 'TEXT']],
      ['DATETIME', ['TIMESTAMP', 'TEXT']],
      ['TIMESTAMP', ['TEXT']],
    ])

    const compatibleTargets = compatibleConversions.get(from)
    return compatibleTargets ? compatibleTargets.includes(to) : false
  }

  private async executeInTransaction(kyselyInstance: AnyKyselyDatabase, diff: MigrationDiff): Promise<MigrationResult> {
    const startTime = Date.now()
    let statementsExecuted = 0
    const errors: MigrationError[] = []

    try {
      await kyselyInstance.transaction().execute(async (trx: AnyKyselyTransaction) => {
        for (const statement of diff.statements) {
          try {
            await trx.executeQuery(sql`${sql.raw(statement)}`.compile(trx))
            statementsExecuted++
          } catch (error) {
            errors.push({
              message: error instanceof Error ? error.message : String(error),
              statement,
              stack: error instanceof Error ? error.stack : undefined,
            })
            throw error
          }
        }
      })

      return {
        success: true,
        statementsExecuted,
        executionTime: Date.now() - startTime,
        errors,
      }
    } catch (error) {
      return {
        success: false,
        statementsExecuted,
        executionTime: Date.now() - startTime,
        errors:
          errors.length > 0
            ? errors
            : [
                {
                  message: error instanceof Error ? error.message : String(error),
                  stack: error instanceof Error ? error.stack : undefined,
                },
              ],
      }
    }
  }

  private async executeStatements(kyselyInstance: AnyKyselyDatabase, diff: MigrationDiff): Promise<MigrationResult> {
    const startTime = Date.now()
    let statementsExecuted = 0
    const errors: MigrationError[] = []

    for (const statement of diff.statements) {
      try {
        await kyselyInstance.executeQuery(sql`${sql.raw(statement)}`.compile(kyselyInstance))
        statementsExecuted++
      } catch (error) {
        errors.push({
          message: error instanceof Error ? error.message : String(error),
          statement,
          stack: error instanceof Error ? error.stack : undefined,
        })
      }
    }

    return {
      success: errors.length === 0,
      statementsExecuted,
      executionTime: Date.now() - startTime,
      errors,
    }
  }

  private async ensureMigrationTableExists(kyselyInstance: AnyKyselyDatabase): Promise<void> {
    try {
      const tableExists = await kyselyInstance.introspection
        .getTables()
        .then((tables) => tables.some((t) => t.name === this.options.migrationTableName))

      if (!tableExists) {
        await kyselyInstance.schema
          .createTable(this.options.migrationTableName)
          .addColumn('id', 'varchar(255)', (col) => col.primaryKey())
          .addColumn('name', 'varchar(255)', (col) => col.notNull())
          .addColumn('checksum', 'varchar(255)', (col) => col.notNull())
          .addColumn('appliedAt', 'timestamp', (col) => col.notNull().defaultTo(sql.raw('CURRENT_TIMESTAMP')))
          .addColumn('executionTime', 'integer', (col) => col.notNull())
          .addColumn('success', 'boolean', (col) => col.notNull())
          .addColumn('statements', 'text', (col) => col)
          .addColumn('dependencies', 'text', (col) => col)
          .addColumn('schemaVersion', 'varchar(255)', (col) => col)
          .addColumn('rollbackStatements', 'text', (col) => col)
          .addColumn('rollbackChecksum', 'varchar(255)', (col) => col)
          .addColumn('canRollback', 'boolean', (col) => col.defaultTo(sql.raw('false')))
          .addColumn('rollbackWarnings', 'text', (col) => col)
          .execute()
      } else {
        // Check if we need to add new columns for existing tables
        await this.upgradeHistoryTableSchema(kyselyInstance)
      }
    } catch (error) {
      throw new Error(`Failed to create migration table: ${error instanceof Error ? error.message : String(error)}`)
    }
  }

  private async recordMigration(
    kyselyInstance: AnyKyselyDatabase,
    diff: MigrationDiff,
    executionTime: number,
  ): Promise<void> {
    try {
      await this.ensureMigrationTableExists(kyselyInstance)

      const migrationId = `migration_${Date.now()}`
      const checksum = this.generateChecksum(diff.statements.join('\n'))

      // Generate rollback information
      let rollbackInfo: MigrationRollback | null = null
      try {
        rollbackInfo = this.generateRollbackForStatements(kyselyInstance, diff.statements)
      } catch (error) {
        console.warn(`Failed to generate rollback info: ${error instanceof Error ? error.message : String(error)}`)
      }

      await kyselyInstance
        .insertInto(this.options.migrationTableName)
        .values({
          id: migrationId,
          name: `Migration ${new Date().toISOString()}`,
          checksum,
          appliedAt: new Date().toISOString(),
          executionTime,
          success: true,
          statements: JSON.stringify(diff.statements),
          dependencies: JSON.stringify([]),
          schemaVersion: `v${Date.now()}`,
          rollbackStatements: rollbackInfo ? JSON.stringify(rollbackInfo.rollbackStatements) : null,
          rollbackChecksum: rollbackInfo?.rollbackChecksum || null,
          canRollback: rollbackInfo?.canRollback ?? false,
          rollbackWarnings: rollbackInfo ? JSON.stringify(rollbackInfo.warnings) : null,
        })
        .execute()
    } catch (error) {
      console.warn(`Failed to record migration: ${error instanceof Error ? error.message : String(error)}`)
    }
  }

  private generateChecksum(content: string): string {
    let hash = 0
    for (let i = 0; i < content.length; i++) {
      const char = content.charCodeAt(i)
      hash = (hash << 5) - hash + char
      hash = hash & hash
    }
    return hash.toString(16)
  }

  /**
   * Ensure migration lock table exists
   */
  private async ensureMigrationLockTableExists(kyselyInstance: AnyKyselyDatabase): Promise<void> {
    try {
      const tableExists = await kyselyInstance.introspection
        .getTables()
        .then((tables) => tables.some((t) => t.name === '_ork_migration_locks'))

      if (!tableExists) {
        await kyselyInstance.schema
          .createTable('_ork_migration_locks')
          .addColumn('id', 'varchar(255)', (col) => col.primaryKey())
          .addColumn('processId', 'varchar(255)', (col) => col.notNull())
          .addColumn('acquiredAt', 'timestamp', (col) => col.notNull())
          .addColumn('expiresAt', 'timestamp', (col) => col.notNull())
          .addColumn('migrationId', 'varchar(255)', (col) => col.notNull())
          .execute()
      }
    } catch (error) {
      throw new Error(
        `Failed to create migration lock table: ${error instanceof Error ? error.message : String(error)}`,
      )
    }
  }

  /**
   * Clean up expired migration locks
   */
  private async cleanupExpiredLocks(kyselyInstance: AnyKyselyDatabase): Promise<void> {
    try {
      const now = new Date().toISOString()
      await kyselyInstance.deleteFrom('_ork_migration_locks').where('expiresAt', '<', now).execute()
    } catch (error) {
      console.warn(`Failed to cleanup expired locks: ${error instanceof Error ? error.message : String(error)}`)
    }
  }

  /**
   * Generate reverse statement for rollback
   */
  private generateReverseStatement(kyselyInstance: AnyKyselyDatabase, statement: string): string | null {
    const normalizedStatement = statement.trim().toUpperCase()

    try {
      // Handle CREATE TABLE
      if (normalizedStatement.startsWith('CREATE TABLE')) {
        const tableNameMatch = statement.match(/CREATE TABLE\s+(\w+)/i)
        if (tableNameMatch) {
          const tableName = tableNameMatch[1]
          return kyselyInstance.schema.dropTable(tableName).compile().sql
        }
      }

      // Handle DROP TABLE
      if (normalizedStatement.startsWith('DROP TABLE')) {
        // Cannot reverse DROP TABLE without knowing the original structure
        return null
      }

      // Handle ALTER TABLE ADD COLUMN
      if (normalizedStatement.includes('ADD COLUMN')) {
        const match = statement.match(/ALTER TABLE\s+(\w+)\s+ADD COLUMN\s+(\w+)/i)
        if (match) {
          const [, tableName, columnName] = match
          return kyselyInstance.schema.alterTable(tableName).dropColumn(columnName).compile().sql
        }
      }

      // Handle ALTER TABLE DROP COLUMN
      if (normalizedStatement.includes('DROP COLUMN')) {
        // Cannot reverse DROP COLUMN without knowing the original column definition
        return null
      }

      // Handle CREATE INDEX
      if (normalizedStatement.startsWith('CREATE INDEX')) {
        const indexNameMatch = statement.match(/CREATE INDEX\s+(\w+)/i)
        if (indexNameMatch) {
          const indexName = indexNameMatch[1]
          return kyselyInstance.schema.dropIndex(indexName).compile().sql
        }
      }

      // Handle DROP INDEX
      if (normalizedStatement.startsWith('DROP INDEX')) {
        // Cannot reverse DROP INDEX without knowing the original index definition
        return null
      }

      return null
    } catch (error) {
      console.warn(`Failed to generate reverse statement for: ${statement}`)
      return null
    }
  }

  /**
   * Record rollback operation in history
   */
  private async recordRollback(
    kyselyInstance: AnyKyselyDatabase,
    originalMigrationId: string,
    rollbackInfo: MigrationRollback,
    executionTime: number,
  ): Promise<void> {
    try {
      await this.ensureMigrationTableExists(kyselyInstance)

      const rollbackId = `rollback_${originalMigrationId}_${Date.now()}`

      await kyselyInstance
        .insertInto(this.options.migrationTableName)
        .values({
          id: rollbackId,
          name: `Rollback of ${originalMigrationId}`,
          checksum: rollbackInfo.rollbackChecksum,
          appliedAt: new Date().toISOString(),
          executionTime,
          success: true,
          statements: JSON.stringify(rollbackInfo.rollbackStatements),
          dependencies: JSON.stringify([]),
          rollbackStatements: null,
          rollbackChecksum: null,
          canRollback: false,
        })
        .execute()
    } catch (error) {
      console.warn(`Failed to record rollback: ${error instanceof Error ? error.message : String(error)}`)
    }
  }

  /**
   * Remove migration from history
   */
  private async removeMigrationFromHistory(kyselyInstance: AnyKyselyDatabase, migrationId: string): Promise<void> {
    try {
      await kyselyInstance.deleteFrom(this.options.migrationTableName).where('id', '=', migrationId).execute()
    } catch (error) {
      console.warn(`Failed to remove migration from history: ${error instanceof Error ? error.message : String(error)}`)
    }
  }

  /**
   * Upgrade existing migration table schema to support new features
   */
  private async upgradeHistoryTableSchema(kyselyInstance: AnyKyselyDatabase): Promise<void> {
    try {
      const tables = await kyselyInstance.introspection.getTables()
      const migrationTable = tables.find((t) => t.name === this.options.migrationTableName)

      if (!migrationTable) return

      const existingColumns = new Set(migrationTable.columns.map((c) => c.name))
      const requiredColumns = [
        { name: 'statements', type: 'text', nullable: true },
        { name: 'dependencies', type: 'text', nullable: true },
        { name: 'schemaVersion', type: 'varchar(255)', nullable: true },
        { name: 'rollbackStatements', type: 'text', nullable: true },
        { name: 'rollbackChecksum', type: 'varchar(255)', nullable: true },
        { name: 'canRollback', type: 'boolean', nullable: true, defaultValue: false },
        { name: 'rollbackWarnings', type: 'text', nullable: true },
      ]

      for (const column of requiredColumns) {
        if (!existingColumns.has(column.name)) {
          try {
            const alterBuilder = kyselyInstance.schema
              .alterTable(this.options.migrationTableName)
              .addColumn(column.name, column.type, (col) => {
                if (column.defaultValue !== undefined) {
                  col = col.defaultTo(column.defaultValue)
                }
                return col
              })

            await alterBuilder.execute()
          } catch (error) {
            console.warn(
              `Failed to add column ${column.name}: ${error instanceof Error ? error.message : String(error)}`,
            )
          }
        }
      }
    } catch (error) {
      console.warn(
        `Failed to upgrade migration table schema: ${error instanceof Error ? error.message : String(error)}`,
      )
    }
  }

  /**
   * Generate rollback information for a set of statements
   */
  private generateRollbackForStatements(kyselyInstance: AnyKyselyDatabase, statements: string[]): MigrationRollback {
    const rollbackStatements: string[] = []
    const warnings: string[] = []

    // Generate reverse operations for each statement
    for (const statement of [...statements].reverse()) {
      const rollbackStatement = this.generateReverseStatement(kyselyInstance, statement)
      if (rollbackStatement) {
        rollbackStatements.push(rollbackStatement)
      } else {
        warnings.push(`Cannot generate rollback for statement: ${statement}`)
      }
    }

    const canRollback = rollbackStatements.length > 0 && warnings.length === 0
    const rollbackChecksum = this.generateChecksum(rollbackStatements.join('\n'))

    return {
      migrationId: '', // Will be set by caller
      rollbackStatements,
      rollbackChecksum,
      canRollback,
      warnings,
    }
  }

  /**
   * Generate detailed migration summary with enhanced metadata
   */
  private async generateDetailedSummary(
    kyselyInstance: AnyKyselyDatabase,
    migrationDiff: MigrationDiff,
  ): Promise<DetailedMigrationSummary> {
    try {
      const currentSchema = await this.introspectDatabase(kyselyInstance)

      // Calculate data impact
      const tablesWithDataLoss = migrationDiff.summary.tablesDropped.concat(
        migrationDiff.summary.columnsDropped.map((c) => c.table),
      )

      const irreversibleOperations: string[] = []
      for (const statement of migrationDiff.statements) {
        if (statement.toUpperCase().includes('DROP TABLE') || statement.toUpperCase().includes('DROP COLUMN')) {
          irreversibleOperations.push(statement)
        }
      }

      // Calculate performance impact
      const downtimeOperations = migrationDiff.statements.filter((stmt) => {
        const upper = stmt.toUpperCase()
        return upper.includes('DROP TABLE') || upper.includes('ALTER TABLE') || upper.includes('CREATE INDEX')
      })

      const slowOperations = migrationDiff.statements.filter((stmt) => {
        const upper = stmt.toUpperCase()
        return upper.includes('CREATE INDEX') || upper.includes('ALTER TABLE') || upper.includes('ADD COLUMN')
      })

      // Calculate dependencies
      const dependentTables: string[] = []
      const affectedConstraints: string[] = []
      const affectedViews: string[] = []

      for (const tableName of migrationDiff.summary.tablesModified.concat(migrationDiff.summary.tablesDropped)) {
        // Find tables that reference this table
        const referencingTables = currentSchema.tables.filter((table) =>
          table.foreignKeys.some((fk) => fk.referencedTable === tableName),
        )
        dependentTables.push(...referencingTables.map((t) => t.name))

        // Find affected constraints
        const table = currentSchema.tables.find((t) => t.name === tableName)
        if (table) {
          affectedConstraints.push(...table.foreignKeys.map((fk) => fk.name))
          affectedConstraints.push(...table.uniqueConstraints.map((uc) => uc.name))
        }
      }

      return {
        ...migrationDiff.summary,
        totalOperations: migrationDiff.statements.length,
        dataImpact: {
          estimatedRowsAffected: 0, // Would need actual row counts from database
          tablesWithDataLoss: [...new Set(tablesWithDataLoss)],
          irreversibleOperations,
        },
        performanceImpact: {
          downtimeOperations,
          slowOperations,
          recommendedMaintenanceWindow: this.calculateMaintenanceWindow(
            migrationDiff.statements.length,
            downtimeOperations.length > 0,
          ),
        },
        dependencies: {
          dependentTables: [...new Set(dependentTables)],
          affectedConstraints: [...new Set(affectedConstraints)],
          affectedViews: [...new Set(affectedViews)],
        },
      }
    } catch (error) {
      throw new Error(`Failed to generate detailed summary: ${error instanceof Error ? error.message : String(error)}`)
    }
  }

  /**
   * Assess migration risk based on operations and metadata
   */
  private assessMigrationRisk(
    kyselyInstance: AnyKyselyDatabase,
    migrationDiff: MigrationDiff,
    detailedSummary: DetailedMigrationSummary,
  ): {
    level: 'low' | 'medium' | 'high'
    factors: string[]
    recommendations: string[]
  } {
    const factors: string[] = []
    const recommendations: string[] = []
    let riskScore = 0

    // Check for destructive operations
    if (migrationDiff.hasDestructiveChanges) {
      riskScore += 3
      factors.push('Contains destructive operations that may cause data loss')
      recommendations.push('Create a backup before proceeding')
    }

    // Check for table drops
    if (detailedSummary.tablesDropped.length > 0) {
      riskScore += 3
      factors.push(`Dropping ${detailedSummary.tablesDropped.length} table(s)`)
      recommendations.push('Verify that dropped tables are no longer needed')
    }

    // Check for column drops
    if (detailedSummary.columnsDropped.length > 0) {
      riskScore += 2
      factors.push(`Dropping ${detailedSummary.columnsDropped.length} column(s)`)
      recommendations.push('Ensure dropped columns are not used by application code')
    }

    // Check for dependent tables
    if (detailedSummary.dependencies.dependentTables.length > 0) {
      riskScore += 2
      factors.push(`Affects ${detailedSummary.dependencies.dependentTables.length} dependent table(s)`)
      recommendations.push('Review impact on dependent tables and foreign key constraints')
    }

    // Check for performance impact
    if (detailedSummary.performanceImpact.downtimeOperations.length > 0) {
      riskScore += 1
      factors.push('May cause temporary downtime')
      recommendations.push('Schedule during maintenance window')
    }

    // Check for large number of operations
    if (detailedSummary.totalOperations > 10) {
      riskScore += 1
      factors.push(`Large number of operations (${detailedSummary.totalOperations})`)
      recommendations.push('Consider breaking into smaller migrations')
    }

    // Determine risk level
    let level: 'low' | 'medium' | 'high'
    if (riskScore >= 5) {
      level = 'high'
    } else if (riskScore >= 2) {
      level = 'medium'
    } else {
      level = 'low'
    }

    // Add general recommendations
    if (level === 'high') {
      recommendations.push('Test thoroughly in staging environment')
      recommendations.push('Have rollback plan ready')
    }

    return { level, factors, recommendations }
  }

  /**
   * Generate rollback preview information
   */
  private generateRollbackPreview(
    kyselyInstance: AnyKyselyDatabase,
    statements: string[],
  ): Promise<{
    available: boolean
    statements: string[]
    warnings: string[]
  }> {
    try {
      const rollbackInfo = this.generateRollbackForStatements(kyselyInstance, statements)
      return {
        available: rollbackInfo.canRollback,
        statements: rollbackInfo.rollbackStatements,
        warnings: rollbackInfo.warnings,
      }
    } catch (error) {
      return {
        available: false,
        statements: [],
        warnings: [`Failed to generate rollback preview: ${error instanceof Error ? error.message : String(error)}`],
      }
    }
  }

  /**
   * Generate human-readable description of migration
   */
  private generateHumanReadableDescription(summary: DetailedMigrationSummary): string {
    const parts: string[] = []

    if (summary.totalOperations === 0) {
      return 'No changes detected - database schema is up to date.'
    }

    // Tables
    if (summary.tablesCreated.length > 0) {
      parts.push(`Create ${summary.tablesCreated.length} table(s): ${summary.tablesCreated.join(', ')}`)
    }
    if (summary.tablesModified.length > 0) {
      parts.push(`Modify ${summary.tablesModified.length} table(s): ${summary.tablesModified.join(', ')}`)
    }
    if (summary.tablesDropped.length > 0) {
      parts.push(`Drop ${summary.tablesDropped.length} table(s): ${summary.tablesDropped.join(', ')}`)
    }

    // Columns
    const totalColumnsChanged =
      summary.columnsAdded.length + summary.columnsModified.length + summary.columnsDropped.length
    if (totalColumnsChanged > 0) {
      const columnParts: string[] = []
      if (summary.columnsAdded.length > 0) {
        columnParts.push(`add ${summary.columnsAdded.length}`)
      }
      if (summary.columnsModified.length > 0) {
        columnParts.push(`modify ${summary.columnsModified.length}`)
      }
      if (summary.columnsDropped.length > 0) {
        columnParts.push(`drop ${summary.columnsDropped.length}`)
      }
      parts.push(`Column changes: ${columnParts.join(', ')}`)
    }

    // Indexes
    if (summary.indexesCreated.length > 0 || summary.indexesDropped.length > 0) {
      const indexParts: string[] = []
      if (summary.indexesCreated.length > 0) {
        indexParts.push(`create ${summary.indexesCreated.length}`)
      }
      if (summary.indexesDropped.length > 0) {
        indexParts.push(`drop ${summary.indexesDropped.length}`)
      }
      parts.push(`Index changes: ${indexParts.join(', ')}`)
    }

    // Data impact warning
    if (summary.dataImpact.tablesWithDataLoss.length > 0) {
      parts.push(`⚠️  WARNING: Operations may cause data loss in: ${summary.dataImpact.tablesWithDataLoss.join(', ')}`)
    }

    return parts.join('\n')
  }

  /**
   * Calculate recommended maintenance window
   */
  private calculateMaintenanceWindow(operationCount: number, hasDowntimeOperations: boolean): string {
    if (!hasDowntimeOperations && operationCount <= 5) {
      return 'No maintenance window required'
    }

    if (operationCount <= 5) {
      return '5-10 minutes'
    } else if (operationCount <= 15) {
      return '15-30 minutes'
    } else {
      return '30+ minutes'
    }
  }

  /**
   * Display migration preview to user
   */
  private displayMigrationPreview(preview: MigrationPreview, loggingConfig: MigrationLoggingConfig): void {
    this.log(loggingConfig, 'info', '\n=== MIGRATION PREVIEW ===')
    this.log(loggingConfig, 'info', preview.description)

    this.log(loggingConfig, 'info', `\nRisk Level: ${preview.riskAssessment.level.toUpperCase()}`)

    if (preview.riskAssessment.factors.length > 0) {
      this.log(loggingConfig, 'info', '\nRisk Factors:')
      preview.riskAssessment.factors.forEach((factor) => {
        this.log(loggingConfig, 'info', `  • ${factor}`)
      })
    }

    if (preview.riskAssessment.recommendations.length > 0) {
      this.log(loggingConfig, 'info', '\nRecommendations:')
      preview.riskAssessment.recommendations.forEach((rec) => {
        this.log(loggingConfig, 'info', `  • ${rec}`)
      })
    }

    this.log(
      loggingConfig,
      'info',
      `\nEstimated execution time: ${preview.summary.performanceImpact.recommendedMaintenanceWindow}`,
    )

    if (preview.rollbackInfo.available) {
      this.log(loggingConfig, 'info', '✅ Rollback available')
    } else {
      this.log(loggingConfig, 'warn', '⚠️  Rollback not available')
      if (preview.rollbackInfo.warnings.length > 0) {
        preview.rollbackInfo.warnings.forEach((warning) => {
          this.log(loggingConfig, 'warn', `  • ${warning}`)
        })
      }
    }

    if (loggingConfig.logStatements && preview.statements.length > 0) {
      this.log(loggingConfig, 'info', '\nSQL Statements to execute:')
      preview.statements.forEach((stmt, index) => {
        this.log(loggingConfig, 'info', `  ${index + 1}. ${stmt}`)
      })
    }

    this.log(loggingConfig, 'info', '========================\n')
  }

  /**
   * Check if confirmation prompt should be shown
   */
  private shouldPromptForConfirmation(preview: MigrationPreview, config: MigrationPromptConfig): boolean {
    if (!config.enabled) return false

    const riskLevels = { low: 1, medium: 2, high: 3 }
    const previewRiskLevel = riskLevels[preview.riskAssessment.level]
    const minimumRiskLevel = riskLevels[config.minimumRiskLevel]

    return previewRiskLevel >= minimumRiskLevel
  }

  /**
   * Prompt user for confirmation (mock implementation - would be replaced with actual CLI prompts)
   */
  private promptForConfirmation(
    preview: MigrationPreview,
    config: MigrationPromptConfig,
    loggingConfig: MigrationLoggingConfig,
  ): boolean {
    // In a real implementation, this would use a CLI prompt library like inquirer
    // For now, we'll simulate based on risk level and configuration

    const message =
      config.customMessages?.confirmationPrompt ||
      `Do you want to proceed with this ${preview.riskAssessment.level} risk migration?`

    this.log(loggingConfig, 'info', message)

    // For testing purposes, automatically approve low/medium risk, require explicit approval for high risk
    if (preview.riskAssessment.level === 'high' && config.requireExplicitConfirmation) {
      this.log(loggingConfig, 'warn', 'High-risk migration requires explicit confirmation')
      // In real implementation, would wait for user input
      return false // Conservative default for high-risk operations
    }

    return true // Auto-approve for testing
  }

  /**
   * Execute statements with progress reporting
   */
  private async executeStatementsWithProgress(
    kyselyInstance: AnyKyselyDatabase,
    diff: MigrationDiff,
    loggingConfig: MigrationLoggingConfig,
  ): Promise<MigrationResult> {
    const startTime = Date.now()
    let statementsExecuted = 0
    const errors: MigrationError[] = []

    for (let i = 0; i < diff.statements.length; i++) {
      const statement = diff.statements[i]

      // Report progress
      const progress: MigrationProgress = {
        currentStep: i + 1,
        totalSteps: diff.statements.length,
        currentOperation: statement.substring(0, 50) + (statement.length > 50 ? '...' : ''),
        percentComplete: Math.round(((i + 1) / diff.statements.length) * 100),
        timeElapsed: Date.now() - startTime,
        statementsExecuted,
        warnings: [],
      }

      if (loggingConfig.logProgress) {
        this.log(loggingConfig, 'info', `[${progress.percentComplete}%] Executing: ${progress.currentOperation}`)
      }

      try {
        const statementStartTime = Date.now()
        await kyselyInstance.executeQuery(sql`${sql.raw(statement)}`.compile(kyselyInstance))
        statementsExecuted++

        if (loggingConfig.logExecutionTimes) {
          const executionTime = Date.now() - statementStartTime
          this.log(loggingConfig, 'debug', `Statement executed in ${executionTime}ms`)
        }
      } catch (error) {
        errors.push({
          message: error instanceof Error ? error.message : String(error),
          statement,
          stack: error instanceof Error ? error.stack : undefined,
        })

        this.log(loggingConfig, 'error', `Failed to execute statement: ${statement}`, { error })
      }
    }

    return {
      success: errors.length === 0,
      statementsExecuted,
      executionTime: Date.now() - startTime,
      errors,
    }
  }

  /**
   * Execute statements in transaction with progress reporting
   */
  private async executeInTransactionWithProgress(
    kyselyInstance: AnyKyselyDatabase,
    diff: MigrationDiff,
    loggingConfig: MigrationLoggingConfig,
  ): Promise<MigrationResult> {
    const startTime = Date.now()
    let statementsExecuted = 0
    const errors: MigrationError[] = []

    try {
      await kyselyInstance.transaction().execute(async (trx: AnyKyselyTransaction) => {
        for (let i = 0; i < diff.statements.length; i++) {
          const statement = diff.statements[i]

          // Report progress
          const progress: MigrationProgress = {
            currentStep: i + 1,
            totalSteps: diff.statements.length,
            currentOperation: statement.substring(0, 50) + (statement.length > 50 ? '...' : ''),
            percentComplete: Math.round(((i + 1) / diff.statements.length) * 100),
            timeElapsed: Date.now() - startTime,
            statementsExecuted,
            warnings: [],
          }

          if (loggingConfig.logProgress) {
            this.log(loggingConfig, 'info', `[${progress.percentComplete}%] Executing: ${progress.currentOperation}`)
          }

          try {
            const statementStartTime = Date.now()
            await trx.executeQuery(sql`${sql.raw(statement)}`.compile(trx))
            statementsExecuted++

            if (loggingConfig.logExecutionTimes) {
              const executionTime = Date.now() - statementStartTime
              this.log(loggingConfig, 'debug', `Statement executed in ${executionTime}ms`)
            }
          } catch (error) {
            errors.push({
              message: error instanceof Error ? error.message : String(error),
              statement,
              stack: error instanceof Error ? error.stack : undefined,
            })
            throw error // Re-throw to rollback transaction
          }
        }
      })

      return {
        success: true,
        statementsExecuted,
        executionTime: Date.now() - startTime,
        errors,
      }
    } catch (error) {
      return {
        success: false,
        statementsExecuted,
        executionTime: Date.now() - startTime,
        errors:
          errors.length > 0
            ? errors
            : [
                {
                  message: error instanceof Error ? error.message : String(error),
                  stack: error instanceof Error ? error.stack : undefined,
                },
              ],
      }
    }
  }

  /**
   * Log message with appropriate level and formatting
   */
  private log(config: MigrationLoggingConfig, level: string, message: string, metadata?: unknown): void {
    if (config.customLogger) {
      config.customLogger(level, message, metadata)
      return
    }

    // Default console logging
    const timestamp = new Date().toISOString()
    const formattedMessage = `[${timestamp}] [${level.toUpperCase()}] ${message}`

    switch (level) {
      case 'error':
        console.error(formattedMessage, metadata || '')
        break
      case 'warn':
        console.warn(formattedMessage, metadata || '')
        break
      case 'info':
        console.info(formattedMessage, metadata || '')
        break
      case 'debug':
        if (config.level === 'debug') {
          console.debug(formattedMessage, metadata || '')
        }
        break
      default:
        console.log(formattedMessage, metadata || '')
    }
  }

  private asRecord(value: unknown): Record<string, unknown> {
    if (typeof value === 'object' && value !== null) {
      return value as Record<string, unknown>
    }
    return {}
  }

  private coerceString(value: unknown, fallback = ''): string {
    if (typeof value === 'string') return value
    if (typeof value === 'number' || typeof value === 'boolean') return String(value)
    if (value instanceof Date) return value.toISOString()
    return fallback
  }

  private optionalString(value: unknown): string | undefined {
    if (typeof value !== 'string') return undefined
    return value.length > 0 ? value : undefined
  }

  private coerceNumber(value: unknown, fallback = 0): number {
    if (typeof value === 'number' && Number.isFinite(value)) return value
    if (typeof value === 'string') {
      const parsed = Number(value)
      if (Number.isFinite(parsed)) return parsed
    }
    if (typeof value === 'boolean') return value ? 1 : 0
    return fallback
  }

  private coerceBoolean(value: unknown): boolean {
    if (typeof value === 'boolean') return value
    if (typeof value === 'number') return value !== 0
    if (typeof value === 'string') {
      const normalized = value.trim().toLowerCase()
      return normalized === 'true' || normalized === '1'
    }
    return false
  }

  private coerceDate(value: unknown): Date {
    if (value instanceof Date) return value
    const date = new Date(this.coerceString(value))
    return Number.isNaN(date.getTime()) ? new Date(0) : date
  }

  private parseJsonStringArray(value: unknown): string[] {
    if (Array.isArray(value)) {
      return value.filter((item): item is string => typeof item === 'string')
    }
    if (typeof value !== 'string') {
      return []
    }
    try {
      const parsed = JSON.parse(value)
      if (!Array.isArray(parsed)) return []
      return parsed.filter((item): item is string => typeof item === 'string')
    } catch {
      return []
    }
  }

  /**
   * Compare foreign keys between current database table and target model
   */
  private compareForeignKeys(
    kyselyInstance: AnyKyselyDatabase,
    currentTable: DatabaseTable,
    targetModel: ModelAST,
  ): {
    hasChanges: boolean
    foreignKeysCreated: string[]
    foreignKeysDropped: string[]
    statements: string[]
  } {
    const result = {
      hasChanges: false,
      foreignKeysCreated: [] as string[],
      foreignKeysDropped: [] as string[],
      statements: [] as string[],
    }

    try {
      // Extract current foreign keys
      const currentForeignKeys = new Map(currentTable.foreignKeys.map((fk) => [fk.name, fk]))

      // Extract target foreign keys from schema AST
      const targetForeignKeys = this.extractForeignKeysFromModel(targetModel)
      const targetForeignKeysMap = new Map(targetForeignKeys.map((fk) => [fk.name, fk]))

      // Find foreign keys to drop (exist in current but not in target)
      for (const [fkName] of currentForeignKeys) {
        if (!targetForeignKeysMap.has(fkName)) {
          result.hasChanges = true
          result.foreignKeysDropped.push(fkName)
          result.statements.push(this.generateDropForeignKeyStatement(kyselyInstance, currentTable.name, fkName))
        }
      }

      // Find foreign keys to create (exist in target but not in current)
      for (const [fkName, targetFk] of targetForeignKeysMap) {
        const currentFk = currentForeignKeys.get(fkName)

        if (!currentFk) {
          // New foreign key to create
          result.hasChanges = true
          result.foreignKeysCreated.push(fkName)
          result.statements.push(this.generateAddForeignKeyStatement(kyselyInstance, currentTable.name, targetFk))
        } else if (!this.areForeignKeysEqual(currentFk, targetFk)) {
          // Foreign key exists but is different - drop and recreate
          result.hasChanges = true
          result.foreignKeysDropped.push(fkName)
          result.foreignKeysCreated.push(fkName)
          result.statements.push(this.generateDropForeignKeyStatement(kyselyInstance, currentTable.name, fkName))
          result.statements.push(this.generateAddForeignKeyStatement(kyselyInstance, currentTable.name, targetFk))
        }
      }

      return result
    } catch (error) {
      console.warn(
        `Failed to compare foreign keys for table ${currentTable.name}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      )
      return result
    }
  }

  /**
   * Extract foreign key constraints from model AST
   */
  private extractForeignKeysFromModel(model: ModelAST): DatabaseForeignKey[] {
    const foreignKeys: DatabaseForeignKey[] = []

    try {
      // Look for relation fields with explicit relation attributes
      for (const field of model.fields) {
        const relationAttr = field.attributes?.find((attr: AttributeAST) => attr.name === 'relation')

        if (relationAttr && !field.isList) {
          // This is a relation field that should have a foreign key
          const referencedModel = field.fieldType

          // Look for fields attribute in @relation to find the foreign key columns
          const fieldsArg = relationAttr.args?.find(
            (arg: AttributeArgumentAST) => typeof arg === 'object' && 'name' in arg && arg.name === 'fields',
          )
          const referencesArg = relationAttr.args?.find(
            (arg: AttributeArgumentAST) => typeof arg === 'object' && 'name' in arg && arg.name === 'references',
          )

          if (fieldsArg && referencesArg && 'value' in fieldsArg && 'value' in referencesArg) {
            const localColumns = Array.isArray(fieldsArg.value)
              ? fieldsArg.value.map(String)
              : [String(fieldsArg.value)]
            const referencedColumns = Array.isArray(referencesArg.value)
              ? referencesArg.value.map(String)
              : [String(referencesArg.value)]

            // Generate constraint name
            const constraintName = this.generateForeignKeyName(model.name, localColumns, referencedModel)

            // Extract onDelete and onUpdate actions
            const onDeleteArg = relationAttr.args?.find(
              (arg: AttributeArgumentAST) => typeof arg === 'object' && 'name' in arg && arg.name === 'onDelete',
            )
            const onUpdateArg = relationAttr.args?.find(
              (arg: AttributeArgumentAST) => typeof arg === 'object' && 'name' in arg && arg.name === 'onUpdate',
            )

            const parseAction = (
              value: AttributeArgumentAST['value'] | undefined,
              fallback: DatabaseForeignKey['onDelete'],
            ): DatabaseForeignKey['onDelete'] => {
              if (typeof value === 'string') {
                const normalized = value.toUpperCase()
                if (
                  normalized === 'CASCADE' ||
                  normalized === 'SET NULL' ||
                  normalized === 'RESTRICT' ||
                  normalized === 'NO ACTION'
                ) {
                  return normalized
                }
              }
              return fallback
            }

            const onDelete = parseAction(onDeleteArg?.value, 'RESTRICT')
            const onUpdate = parseAction(onUpdateArg?.value, 'RESTRICT')

            foreignKeys.push({
              name: constraintName,
              columns: localColumns,
              referencedTable: this.getTableName({ name: referencedModel }),
              referencedColumns: referencedColumns,
              onDelete,
              onUpdate,
            })
          }
        }
      }

      return foreignKeys
    } catch (error) {
      console.warn(
        `Failed to extract foreign keys from model ${model.name}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      )
      return []
    }
  }

  /**
   * Generate deterministic foreign key constraint name
   */
  private generateForeignKeyName(tableName: string, localColumns: string[], referencedTable: string): string {
    const cols = localColumns.join('_')
    return `fk_${tableName}_${cols}_${referencedTable}`
  }

  /**
   * Check if two foreign keys are equivalent
   */
  private areForeignKeysEqual(fk1: DatabaseForeignKey, fk2: DatabaseForeignKey): boolean {
    return (
      fk1.columns.length === fk2.columns.length &&
      fk1.columns.every((col, i) => col === fk2.columns[i]) &&
      fk1.referencedTable === fk2.referencedTable &&
      fk1.referencedColumns.length === fk2.referencedColumns.length &&
      fk1.referencedColumns.every((col, i) => col === fk2.referencedColumns[i]) &&
      fk1.onDelete === fk2.onDelete &&
      fk1.onUpdate === fk2.onUpdate
    )
  }

  /**
   * Generate ADD CONSTRAINT statement for foreign key
   */
  private generateAddForeignKeyStatement(
    kyselyInstance: AnyKyselyDatabase,
    tableName: string,
    foreignKey: DatabaseForeignKey,
  ): string {
    try {
      const localCols = foreignKey.columns.map((c) => `"${c}"`).join(', ')
      const refCols = foreignKey.referencedColumns.map((c) => `"${c}"`).join(', ')

      let sql =
        `ALTER TABLE "${tableName}" ADD CONSTRAINT "${foreignKey.name}" ` +
        `FOREIGN KEY (${localCols}) REFERENCES "${foreignKey.referencedTable}" (${refCols})`

      if (foreignKey.onDelete && foreignKey.onDelete !== 'RESTRICT') {
        sql += ` ON DELETE ${foreignKey.onDelete}`
      }
      if (foreignKey.onUpdate && foreignKey.onUpdate !== 'RESTRICT') {
        sql += ` ON UPDATE ${foreignKey.onUpdate}`
      }

      return sql
    } catch (error) {
      throw new Error(
        `Failed to generate ADD CONSTRAINT statement: ${error instanceof Error ? error.message : String(error)}`,
      )
    }
  }

  /**
   * Generate DROP CONSTRAINT statement for foreign key
   */
  private generateDropForeignKeyStatement(
    kyselyInstance: AnyKyselyDatabase,
    tableName: string,
    constraintName: string,
  ): string {
    try {
      return `ALTER TABLE "${tableName}" DROP CONSTRAINT "${constraintName}"`
    } catch (error) {
      throw new Error(
        `Failed to generate DROP CONSTRAINT statement: ${error instanceof Error ? error.message : String(error)}`,
      )
    }
  }

  /**
   * Compare indexes between current database table and target model
   */
  private compareIndexes(
    kyselyInstance: AnyKyselyDatabase,
    currentTable: DatabaseTable,
    targetModel: ModelAST,
    dialect: DatabaseDialect,
  ): {
    hasChanges: boolean
    indexesCreated: string[]
    indexesDropped: string[]
    statements: string[]
  } {
    const result = {
      hasChanges: false,
      indexesCreated: [] as string[],
      indexesDropped: [] as string[],
      statements: [] as string[],
    }

    try {
      // Extract current indexes (note: the introspection currently returns empty array,
      // but this is structured for future enhancement when proper index introspection is added)
      const currentIndexes = new Map<string, DatabaseIndex>()
      for (const index of currentTable.indexes ?? []) {
        currentIndexes.set(index.name, index)
      }

      // Extract target indexes from schema AST
      const targetIndexes = this.extractIndexesFromModel(targetModel)
      const targetIndexesMap = new Map(targetIndexes.map((idx) => [idx.name, idx]))

      // Find indexes to drop (exist in current but not in target)
      for (const [idxName] of currentIndexes) {
        if (!targetIndexesMap.has(String(idxName))) {
          result.hasChanges = true
          result.indexesDropped.push(String(idxName))
          result.statements.push(this.generateDropIndexStatement(kyselyInstance, String(idxName)))
        }
      }

      // Find indexes to create (exist in target but not in current)
      for (const [idxName, targetIdx] of targetIndexesMap) {
        const currentIdx = currentIndexes.get(String(idxName))

        if (!currentIdx) {
          // New index to create
          result.hasChanges = true
          result.indexesCreated.push(String(idxName))
          result.statements.push(
            this.generateCreateIndexSQL(
              String(idxName),
              currentTable.name,
              targetIdx.columns,
              targetIdx.unique,
              true, // ifNotExists
              dialect,
            ),
          )
        } else if (!this.areIndexesEqual(currentIdx, targetIdx)) {
          // Index exists but is different - drop and recreate
          result.hasChanges = true
          result.indexesDropped.push(String(idxName))
          result.indexesCreated.push(String(idxName))
          result.statements.push(this.generateDropIndexStatement(kyselyInstance, String(idxName)))
          result.statements.push(
            this.generateCreateIndexSQL(
              String(idxName),
              currentTable.name,
              targetIdx.columns,
              targetIdx.unique,
              true, // ifNotExists
              dialect,
            ),
          )
        }
      }

      return result
    } catch (error) {
      console.warn(
        `Failed to compare indexes for table ${currentTable.name}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      )
      return result
    }
  }

  /**
   * Extract indexes from model AST (including @unique fields and @@index blocks)
   */
  private extractIndexesFromModel(model: ModelAST): Array<{
    name: string
    columns: string[]
    unique: boolean
    tableName: string
  }> {
    const indexes: Array<{
      name: string
      columns: string[]
      unique: boolean
      tableName: string
    }> = []

    try {
      const tableName = this.getTableName(model)

      // Extract @unique field indexes
      for (const field of model.fields) {
        const uniqueAttr = field.attributes?.find((attr: AttributeAST) => attr.name === 'unique')
        if (uniqueAttr) {
          const indexName = this.generateIndexName(tableName, [field.name], true)
          indexes.push({
            name: indexName,
            columns: [field.name],
            unique: true,
            tableName,
          })
        }
      }

      // Extract @@index model-level indexes
      const indexAttrs = model.attributes?.filter((attr: AttributeAST) => attr.name === 'index') || []
      for (const indexAttr of indexAttrs) {
        // Parse @@index([field1, field2], name: "custom_idx", unique: true)
        const fieldsArg = indexAttr.args?.find(
          (arg: AttributeArgumentAST) =>
            Array.isArray(arg) || (typeof arg === 'object' && 'value' in arg && Array.isArray(arg.value)),
        )
        const nameArg = indexAttr.args?.find(
          (arg: AttributeArgumentAST) => typeof arg === 'object' && 'name' in arg && arg.name === 'name',
        )
        const uniqueArg = indexAttr.args?.find(
          (arg: AttributeArgumentAST) => typeof arg === 'object' && 'name' in arg && arg.name === 'unique',
        )

        if (fieldsArg) {
          let columns: string[]
          if (Array.isArray(fieldsArg)) {
            columns = fieldsArg.map(String)
          } else if ('value' in fieldsArg && Array.isArray(fieldsArg.value)) {
            columns = fieldsArg.value.map(String)
          } else {
            continue // Skip if we can't parse the columns
          }

          const customName = nameArg && 'value' in nameArg ? String(nameArg.value) : null
          const isUnique = uniqueArg && 'value' in uniqueArg ? Boolean(uniqueArg.value) : false

          const indexName = customName || this.generateIndexName(tableName, columns, isUnique)

          indexes.push({
            name: indexName,
            columns,
            unique: isUnique,
            tableName,
          })
        }
      }

      // Extract @@unique model-level unique constraints (treated as unique indexes)
      const uniqueAttrs = model.attributes?.filter((attr: AttributeAST) => attr.name === 'unique') || []
      for (const uniqueAttr of uniqueAttrs) {
        const fieldsArg = uniqueAttr.args?.find(
          (arg: AttributeArgumentAST) =>
            Array.isArray(arg) || (typeof arg === 'object' && 'value' in arg && Array.isArray(arg.value)),
        )
        const nameArg = uniqueAttr.args?.find(
          (arg: AttributeArgumentAST) => typeof arg === 'object' && 'name' in arg && arg.name === 'name',
        )

        if (fieldsArg) {
          let columns: string[]
          if (Array.isArray(fieldsArg)) {
            columns = fieldsArg.map(String)
          } else if ('value' in fieldsArg && Array.isArray(fieldsArg.value)) {
            columns = fieldsArg.value.map(String)
          } else {
            continue
          }

          const customName = nameArg && 'value' in nameArg ? String(nameArg.value) : null
          const indexName = customName || this.generateIndexName(tableName, columns, true)

          indexes.push({
            name: indexName,
            columns,
            unique: true,
            tableName,
          })
        }
      }

      return indexes
    } catch (error) {
      console.warn(
        `Failed to extract indexes from model ${model.name}: ${error instanceof Error ? error.message : String(error)}`,
      )
      return []
    }
  }

  /**
   * Check if two indexes are equivalent
   */
  private areIndexesEqual(
    idx1: { name: string; columns: string[]; unique: boolean },
    idx2: { name: string; columns: string[]; unique: boolean },
  ): boolean {
    return (
      idx1.name === idx2.name &&
      idx1.unique === idx2.unique &&
      idx1.columns.length === idx2.columns.length &&
      idx1.columns.every((col, i) => col === idx2.columns[i])
    )
  }

  /**
   * Extract default value from a field AST
   */
  private extractDefaultValueFromField(field: FieldAST): unknown {
    const defaultAttr = field.attributes?.find((attr: AttributeAST) => attr.name === 'default')
    if (!defaultAttr?.args?.[0]) {
      return null
    }

    const defaultValue = defaultAttr.args[0].value || defaultAttr.args[0]
    return defaultValue
  }

  /**
   * Normalize default value for comparison
   */
  private normalizeDefaultValue(value: unknown): string | null {
    if (value === null || value === undefined) {
      return null
    }

    if (typeof value === 'string') {
      // Handle special Prisma functions
      if (value === 'autoincrement()') return 'AUTOINCREMENT'
      if (value === 'now()') return 'CURRENT_TIMESTAMP'
      if (value === 'cuid()') return 'UUID'
      if (value === 'uuid()') return 'UUID'
      if (value === 'true') return 'true'
      if (value === 'false') return 'false'

      // Remove quotes from string literals for comparison
      if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
        return value.slice(1, -1)
      }

      return value
    }

    if (typeof value === 'number' || typeof value === 'boolean') {
      return String(value)
    }

    // Handle 'DEFAULT' marker from introspection
    if (value === 'DEFAULT') {
      return 'DEFAULT'
    }

    return String(value)
  }

  /**
   * Describe the change in default values for human-readable output
   */
  private describeDefaultChange(currentDefault: string | null, targetDefault: string | null): string {
    if (currentDefault === null && targetDefault !== null) {
      return `default: none → ${targetDefault}`
    }
    if (currentDefault !== null && targetDefault === null) {
      return `default: ${currentDefault} → none`
    }
    return `default: ${currentDefault} → ${targetDefault}`
  }

  /**
   * Format default value for SQL statement
   */
  private formatDefaultValueForSQL(value: unknown): string {
    if (value === null || value === undefined) {
      return 'NULL'
    }

    if (typeof value === 'string') {
      // Handle special Prisma functions
      if (value === 'autoincrement()') return 'AUTOINCREMENT()'
      if (value === 'now()') return 'CURRENT_TIMESTAMP'
      if (value === 'cuid()') return 'uuid()' // Use database UUID function
      if (value === 'uuid()') return 'uuid()'
      if (value === 'true') return 'true'
      if (value === 'false') return 'false'

      // Handle quoted string literals
      if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
        return value // Already quoted
      }

      // Quote unquoted strings
      return `'${value.replace(/'/g, "''")}'` // Escape single quotes
    }

    if (typeof value === 'number') {
      return String(value)
    }

    if (typeof value === 'boolean') {
      return value ? 'true' : 'false'
    }

    return `'${String(value).replace(/'/g, "''")}'`
  }

  /**
   * Compare enums between current database and target schema
   */
  private compareEnums(
    kyselyInstance: AnyKyselyDatabase,
    currentSchema: DatabaseSchema,
    targetSchema: SchemaAST,
  ): {
    hasChanges: boolean
    enumsCreated: string[]
    enumsModified: string[]
    enumsDropped: string[]
    statements: string[]
  } {
    const result = {
      hasChanges: false,
      enumsCreated: [] as string[],
      enumsModified: [] as string[],
      enumsDropped: [] as string[],
      statements: [] as string[],
    }

    try {
      // Extract current enums (currently empty due to limited introspection)
      const currentEnums = new Map(currentSchema.enums.map((enumType) => [enumType.name, enumType]))

      // Extract target enums from schema AST
      const targetEnums = new Map(targetSchema.enums.map((enumType) => [enumType.name, enumType]))

      // Find enums to drop (exist in current but not in target)
      for (const [enumName] of currentEnums) {
        if (!targetEnums.has(enumName)) {
          result.hasChanges = true
          result.enumsDropped.push(enumName)
          result.statements.push(this.generateDropEnumStatement(kyselyInstance, enumName))
        }
      }

      // Find enums to create or modify
      for (const [enumName, targetEnum] of targetEnums) {
        const currentEnum = currentEnums.get(enumName)

        if (!currentEnum) {
          // New enum to create
          result.hasChanges = true
          result.enumsCreated.push(enumName)
          result.statements.push(this.generateCreateEnumStatement(kyselyInstance, targetEnum))
        } else if (!this.areEnumsEqual(currentEnum, targetEnum)) {
          // Enum exists but values are different
          result.hasChanges = true
          result.enumsModified.push(enumName)

          // For enum modifications, we need to handle carefully to avoid data loss
          const modificationStatements = this.generateEnumModificationStatements(
            kyselyInstance,
            currentEnum,
            targetEnum,
          )
          result.statements.push(...modificationStatements)
        }
      }

      return result
    } catch (error) {
      console.warn(`Failed to compare enums: ${error instanceof Error ? error.message : String(error)}`)
      return result
    }
  }

  /**
   * Check if two enums are equivalent
   */
  private areEnumsEqual(enum1: DatabaseEnum, enum2: EnumAST): boolean {
    const enum2Values = enum2.values.map((v) => v.name)
    return (
      enum1.values.length === enum2Values.length && enum1.values.every((value, index) => value === enum2Values[index])
    )
  }

  /**
   * Generate CREATE TYPE statement for enum
   */
  private generateCreateEnumStatement(kyselyInstance: AnyKyselyDatabase, enumType: EnumAST): string {
    try {
      const values = enumType.values.map((v) => `'${v.name}'`).join(', ')
      return `CREATE TYPE "${enumType.name}" AS ENUM (${values})`
    } catch (error) {
      throw new Error(
        `Failed to generate CREATE TYPE statement: ${error instanceof Error ? error.message : String(error)}`,
      )
    }
  }

  /**
   * Generate DROP TYPE statement for enum
   */
  private generateDropEnumStatement(kyselyInstance: AnyKyselyDatabase, enumName: string): string {
    try {
      return `DROP TYPE IF EXISTS "${enumName}"`
    } catch (error) {
      throw new Error(
        `Failed to generate DROP TYPE statement: ${error instanceof Error ? error.message : String(error)}`,
      )
    }
  }

  /**
   * Generate statements to modify an existing enum (add/remove values)
   */
  private generateEnumModificationStatements(
    kyselyInstance: AnyKyselyDatabase,
    currentEnum: DatabaseEnum,
    targetEnum: EnumAST,
  ): string[] {
    const statements: string[] = []

    try {
      const currentValues = new Set(currentEnum.values)
      const targetValues = targetEnum.values.map((v) => v.name)
      const targetValuesSet = new Set(targetValues)

      // Add new enum values
      for (const value of targetValues) {
        if (!currentValues.has(value)) {
          statements.push(`ALTER TYPE "${currentEnum.name}" ADD VALUE '${value}'`)
        }
      }

      // Note: Removing enum values is more complex and often not supported by databases
      // For PostgreSQL, you cannot remove enum values without recreating the enum
      // This would require checking all columns that use this enum and potentially
      // creating a new enum, updating all columns, then dropping the old enum
      const valuesToRemove = currentEnum.values.filter((value) => !targetValuesSet.has(value))
      if (valuesToRemove.length > 0) {
        console.warn(
          `Cannot safely remove enum values [${valuesToRemove.join(', ')}] from enum '${currentEnum.name}'. ` +
            `This would require recreating the enum which may cause data loss.`,
        )
      }

      return statements
    } catch (error) {
      throw new Error(
        `Failed to generate enum modification statements: ${error instanceof Error ? error.message : String(error)}`,
      )
    }
  }
}
