/**
 * Options for configuring migration operations
 */
export interface MigrationOptions {
  /** Whether to run migrations in a transaction (default: true) */
  useTransaction?: boolean
  /** Timeout for migration operations in milliseconds */
  timeout?: number
  /** Whether to validate schema before applying migrations */
  validateSchema?: boolean
  /** Custom migration table name (default: '_ork_migrations') */
  migrationTableName?: string
}

/**
 * Result of a migration diff operation
 */
export interface MigrationDiff {
  /** SQL statements to be executed */
  statements: string[]
  /** Human-readable summary of changes */
  summary: MigrationSummary
  /** Whether the migration contains potentially destructive operations */
  hasDestructiveChanges: boolean
  /** Estimated impact of the migration */
  impact: MigrationImpact
}

/**
 * Summary of migration changes
 */
export interface MigrationSummary {
  /** Tables to be created */
  tablesCreated: string[]
  /** Tables to be modified */
  tablesModified: string[]
  /** Tables to be dropped */
  tablesDropped: string[]
  /** Columns to be added */
  columnsAdded: Array<{ table: string; column: string }>
  /** Columns to be modified */
  columnsModified: Array<{ table: string; column: string; change: string }>
  /** Columns to be dropped */
  columnsDropped: Array<{ table: string; column: string }>
  /** Indexes to be created */
  indexesCreated: string[]
  /** Indexes to be dropped */
  indexesDropped: string[]
  /** Foreign keys to be created */
  foreignKeysCreated: string[]
  /** Foreign keys to be dropped */
  foreignKeysDropped: string[]
  /** Enums to be created */
  enumsCreated: string[]
  /** Enums to be modified */
  enumsModified: string[]
  /** Enums to be dropped */
  enumsDropped: string[]
}

/**
 * Impact assessment of a migration
 */
export interface MigrationImpact {
  /** Risk level of the migration */
  riskLevel: 'low' | 'medium' | 'high'
  /** Estimated time to complete */
  estimatedDuration: string
  /** Warnings about potential issues */
  warnings: string[]
  /** Tables that may be locked during migration */
  tablesAffected: string[]
}

/**
 * Result of applying a migration
 */
export interface MigrationResult {
  /** Whether the migration was successful */
  success: boolean
  /** Number of statements executed */
  statementsExecuted: number
  /** Time taken to execute the migration */
  executionTime: number
  /** Any errors that occurred */
  errors: MigrationError[]
  /** Migration ID that was applied */
  migrationId?: string
}

/**
 * Migration error information
 */
export interface MigrationError {
  /** Error message */
  message: string
  /** SQL statement that caused the error */
  statement?: string
  /** Error code from the database */
  code?: string
  /** Stack trace if available */
  stack?: string
}

/**
 * Migration history entry
 */
export interface MigrationHistoryEntry {
  /** Unique migration ID */
  id: string
  /** Migration name/description */
  name: string
  /** Checksum of the migration */
  checksum: string
  /** When the migration was applied */
  appliedAt: Date
  /** Time taken to execute */
  executionTime: number
  /** Whether the migration was successful */
  success: boolean
}

/** Migration state for tracking concurrent operations */
export interface MigrationState {
  /** Whether a migration is currently in progress */
  isRunning: boolean
  /** ID of the currently running migration */
  runningMigrationId?: string
  /** Process ID or session ID of the running migration */
  processId?: string
  /** When the current migration started */
  startedAt?: Date
  /** Lock timeout in milliseconds */
  lockTimeout?: number
}

/** Migration lock for preventing concurrent operations */
export interface MigrationLock {
  /** Unique lock ID */
  id: string
  /** Process or session identifier */
  processId: string
  /** When the lock was acquired */
  acquiredAt: Date
  /** When the lock expires */
  expiresAt: Date
  /** Migration ID being executed */
  migrationId: string
}

/** Migration rollback information */
export interface MigrationRollback {
  /** Original migration ID */
  migrationId: string
  /** Rollback SQL statements */
  rollbackStatements: string[]
  /** Rollback checksum */
  rollbackChecksum: string
  /** Whether rollback is available */
  canRollback: boolean
  /** Rollback warnings */
  warnings: string[]
}

/** Enhanced migration history entry with rollback support */
export interface EnhancedMigrationHistoryEntry extends MigrationHistoryEntry {
  /** Rollback information if available */
  rollback?: MigrationRollback
  /** Migration statements that were executed */
  statements: string[]
  /** Schema version after this migration */
  schemaVersion?: string
  /** Migration dependencies */
  dependencies: string[]
}

/** Migration validation result */
export interface MigrationValidation {
  /** Whether the migration is valid */
  isValid: boolean
  /** Validation errors */
  errors: string[]
  /** Validation warnings */
  warnings: string[]
  /** Checksum validation result */
  checksumValid: boolean
  /** Schema integrity check result */
  schemaIntegrityValid: boolean
}

/** Enhanced migration summary with detailed information */
export interface DetailedMigrationSummary extends MigrationSummary {
  /** Total number of operations */
  totalOperations: number
  /** Estimated data impact */
  dataImpact: {
    /** Estimated rows affected */
    estimatedRowsAffected: number
    /** Tables with potential data loss */
    tablesWithDataLoss: string[]
    /** Operations that cannot be undone */
    irreversibleOperations: string[]
  }
  /** Performance impact assessment */
  performanceImpact: {
    /** Operations that may cause downtime */
    downtimeOperations: string[]
    /** Operations that may be slow */
    slowOperations: string[]
    /** Recommended maintenance window */
    recommendedMaintenanceWindow: string
  }
  /** Dependency information */
  dependencies: {
    /** Tables that depend on modified tables */
    dependentTables: string[]
    /** Foreign key constraints affected */
    affectedConstraints: string[]
    /** Views that may be affected */
    affectedViews: string[]
  }
}

/** Migration confirmation prompt configuration */
export interface MigrationPromptConfig {
  /** Whether to show confirmation prompts */
  enabled: boolean
  /** Minimum risk level to prompt for */
  minimumRiskLevel: 'low' | 'medium' | 'high'
  /** Whether to show detailed summary */
  showDetailedSummary: boolean
  /** Whether to require explicit confirmation for destructive operations */
  requireExplicitConfirmation: boolean
  /** Custom prompt messages */
  customMessages?: {
    destructiveWarning?: string
    confirmationPrompt?: string
    proceedMessage?: string
    cancelMessage?: string
  }
}

/** Migration execution progress */
export interface MigrationProgress {
  /** Current step being executed */
  currentStep: number
  /** Total number of steps */
  totalSteps: number
  /** Current operation description */
  currentOperation: string
  /** Percentage complete */
  percentComplete: number
  /** Time elapsed in milliseconds */
  timeElapsed: number
  /** Estimated time remaining in milliseconds */
  estimatedTimeRemaining?: number
  /** Statements executed so far */
  statementsExecuted: number
  /** Any warnings encountered */
  warnings: string[]
}

/** Migration logging configuration */
export interface MigrationLoggingConfig {
  /** Log level */
  level: 'debug' | 'info' | 'warn' | 'error'
  /** Whether to log SQL statements */
  logStatements: boolean
  /** Whether to log execution times */
  logExecutionTimes: boolean
  /** Whether to log progress updates */
  logProgress: boolean
  /** Custom logger function */
  customLogger?: (level: string, message: string, metadata?: unknown) => void
}

/** Migration preview result */
export interface MigrationPreview {
  /** Detailed summary */
  summary: DetailedMigrationSummary
  /** SQL statements to be executed */
  statements: string[]
  /** Human-readable description */
  description: string
  /** Risk assessment */
  riskAssessment: {
    level: 'low' | 'medium' | 'high'
    factors: string[]
    recommendations: string[]
  }
  /** Rollback information */
  rollbackInfo: {
    available: boolean
    statements: string[]
    warnings: string[]
  }
}

/**
 * Database introspection result
 */
export interface DatabaseSchema {
  /** Database tables */
  tables: DatabaseTable[]
  /** Database views */
  views: DatabaseView[]
  /** Database indexes */
  indexes: DatabaseIndex[]
  /** Database enums */
  enums: DatabaseEnum[]
}

/**
 * Database table information
 */
export interface DatabaseTable {
  /** Table name */
  name: string
  /** Table schema (optional) */
  schema?: string
  /** Whether this is a view */
  isView?: boolean
  /** Table columns */
  columns: DatabaseColumn[]
  /** Primary key columns */
  primaryKey: string[]
  /** Foreign key constraints */
  foreignKeys: DatabaseForeignKey[]
  /** Unique constraints */
  uniqueConstraints: DatabaseUniqueConstraint[]
  /** Table indexes */
  indexes?: DatabaseIndex[]
}

/**
 * Database column information
 */
export interface DatabaseColumn {
  /** Column name */
  name: string
  /** Column type */
  type: string
  /** Whether the column is nullable */
  nullable: boolean
  /** Default value */
  defaultValue?: unknown
  /** Whether the column is auto-incrementing */
  autoIncrement?: boolean
  /** Column comment */
  comment?: string
}

/**
 * Database view information
 */
export interface DatabaseView {
  /** View name */
  name: string
  /** View definition */
  definition: string
}

/**
 * Database index information
 */
export interface DatabaseIndex {
  /** Index name */
  name: string
  /** Table name */
  tableName: string
  /** Indexed columns */
  columns: string[]
  /** Whether the index is unique */
  unique: boolean
}

/**
 * Database foreign key constraint
 */
export interface DatabaseForeignKey {
  /** Constraint name */
  name: string
  /** Local columns */
  columns: string[]
  /** Referenced table */
  referencedTable: string
  /** Referenced columns */
  referencedColumns: string[]
  /** On delete action */
  onDelete?: 'CASCADE' | 'SET NULL' | 'RESTRICT' | 'NO ACTION'
  /** On update action */
  onUpdate?: 'CASCADE' | 'SET NULL' | 'RESTRICT' | 'NO ACTION'
}

/**
 * Database unique constraint
 */
export interface DatabaseUniqueConstraint {
  /** Constraint name */
  name: string
  /** Columns in the constraint */
  columns: string[]
}

/**
 * Database enum type
 */
export interface DatabaseEnum {
  /** Enum name */
  name: string
  /** Enum values */
  values: string[]
}

/**
 * Generic Kysely database interface
 */
export interface CompiledQueryLike {
  sql: string
  parameters?: readonly unknown[]
}

export type DefaultValue = string | number | boolean | Date | { sql: string } | { toOperationNode?: () => unknown }

export interface ColumnBuilderLike {
  notNull(): ColumnBuilderLike
  primaryKey(): ColumnBuilderLike
  defaultTo(value: DefaultValue): ColumnBuilderLike
  setDataType(type: string): ColumnBuilderLike
  setNotNull(): ColumnBuilderLike
  dropNotNull(): ColumnBuilderLike
}

export interface ForeignKeyConstraintBuilderLike {
  onDelete(action: 'no action' | 'restrict' | 'cascade' | 'set null' | 'set default'): ForeignKeyConstraintBuilderLike
  onUpdate(action: 'no action' | 'restrict' | 'cascade' | 'set null' | 'set default'): ForeignKeyConstraintBuilderLike
}

export interface CreateTableBuilderLike {
  addColumn(name: string, type: string, callback?: (column: ColumnBuilderLike) => ColumnBuilderLike | void): this
  addForeignKeyConstraint(
    name: string,
    columns: string[],
    referencedTable: string,
    referencedColumns: string[],
    callback?: (constraint: ForeignKeyConstraintBuilderLike) => ForeignKeyConstraintBuilderLike | void,
  ): this
  compile(): CompiledQueryLike
  execute(): Promise<unknown>
}

export interface AlterTableBuilderLike {
  addColumn(name: string, type: string, callback?: (column: ColumnBuilderLike) => ColumnBuilderLike | void): this
  dropColumn(name: string): this
  alterColumn(name: string, callback: (column: ColumnBuilderLike) => ColumnBuilderLike | void): this
  compile(): CompiledQueryLike
  execute(): Promise<unknown>
}

export interface IndexColumnBuilderLike {
  column(name: string): IndexColumnBuilderLike
  compile(): CompiledQueryLike
  execute(): Promise<unknown>
}

export interface CreateIndexBuilderLike {
  on(tableName: string): IndexColumnBuilderLike
}

export interface DeleteQueryBuilderLike {
  where(column: string, operator: string, value: string | number | boolean | Date): DeleteQueryBuilderLike
  execute(): Promise<unknown>
}

export interface InsertQueryBuilderLike {
  values(values: Record<string, unknown>): { execute(): Promise<unknown> }
}

export interface SelectQueryBuilderLike {
  selectAll(): SelectQueryBuilderLike
  orderBy(column: string, direction?: 'asc' | 'desc'): SelectQueryBuilderLike
  where(column: string, operator: string, value: string | number | boolean | Date): SelectQueryBuilderLike
  execute(): Promise<unknown[]>
}

export interface KyselyIntrospectionTable {
  name: string
  schema?: string
  isView?: boolean
  columns: Array<{
    name: string
    dataType: string
    isNullable: boolean
    hasDefaultValue?: boolean
    isAutoIncrementing?: boolean
    comment?: string
  }>
}

export interface KyselyIntrospectionLike {
  getTables(): Promise<KyselyIntrospectionTable[]>
}

export interface AnyKyselyDatabase {
  schema: {
    createTable(tableName: string): CreateTableBuilderLike
    alterTable(tableName: string): AlterTableBuilderLike
    dropTable(tableName: string): { compile(): CompiledQueryLike; execute(): Promise<unknown> }
    createIndex(indexName: string): CreateIndexBuilderLike
    dropIndex(indexName: string): { compile(): CompiledQueryLike; execute(): Promise<unknown> }
  }
  introspection: KyselyIntrospectionLike
  selectFrom(tableName: string): SelectQueryBuilderLike
  insertInto(tableName: string): InsertQueryBuilderLike
  deleteFrom(tableName: string): DeleteQueryBuilderLike
  transaction(): { execute<T>(callback: (trx: AnyKyselyTransaction) => Promise<T>): Promise<T> }
  executeQuery(query: CompiledQueryLike): Promise<{ rows: unknown[] }>
}

export interface AnyKyselyTransaction {
  executeQuery(query: CompiledQueryLike): Promise<{ rows: unknown[] }>
}
