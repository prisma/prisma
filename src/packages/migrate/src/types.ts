export type DatamodelStep = CreateModelStep | CreateFieldStep

export interface CreateModelStep {
  stepType: 'CreateModel'
  name: string
  embedded: boolean
}

export interface CreateFieldStep {
  stepType: 'CreateField'
  model: string
  name: string
  type: FieldType
  arity: FieldArity
  isUnique: boolean
}

export enum PrimitiveType {
  String = 'String',
  Int = 'Int',
  Float = 'Float',
  Boolean = 'Boolean',
}

export enum FieldArity {
  required = 'required',
  list = 'list',
  optional = 'optional',
}

export type FieldType = BaseFieldType | RelationFieldType

export interface BaseFieldType {
  Base: PrimitiveType
}

export interface RelationFieldType {
  Relation: {
    to: string
    to_field: string | null
    name: string | null
    on_delete: string
  }
}

export interface UnexecutableMigration {
  description: string
}

interface UserFacingError {
  is_panic: boolean
  message: string
  error_code?: string
  meta?: unknown
}

export type UserFacingErrorWithMeta = {
  is_panic: boolean
  message: string
  error_code: '3306'
  meta: {
    migration_name: string
    inner_error?: {
      is_panic: boolean
      message: string
      backtrace: string
    }
  }
}

export type DriftDiagnostic =
  /// The current database schema does not match the schema that would be expected from applying the migration history.
  | { diagnostic: 'driftDetected'; rollback: string }
  // A migration failed to cleanly apply to a temporary database.
  | {
      diagnostic: 'migrationFailedToApply'
      error: UserFacingError
    }

export type HistoryDiagnostic =
  | { diagnostic: 'databaseIsBehind'; unappliedMigrationsNames: string[] }
  | {
      diagnostic: 'migrationsDirectoryIsBehind'
      unpersistedMigrationNames: string[]
    }
  | {
      diagnostic: 'historiesDiverge'
      lastCommonMigrationName: string
      unpersistedMigrationNames: string[]
      unappliedMigrationNames: string[]
    }

export interface MigrationFeedback {
  message: string
  stepIndex: number
}

// eslint-disable-next-line @typescript-eslint/no-namespace
export namespace EngineArgs {
  /**
   * These RPCs need a sourceConfig, therefore a db connection to function
   */

  export interface ListMigrationDirectoriesInput {
    migrationsDirectoryPath: string
  }
  export interface MarkMigrationAppliedInput {
    migrationsDirectoryPath: string
    migrationName: string
  }
  export interface MarkMigrationRolledBackInput {
    migrationName: string
  }
  export interface ApplyScriptInput {
    script: string
  }
  export interface DiagnoseMigrationHistoryInput {
    migrationsDirectoryPath: string
  }
  export interface PlanMigrationInput {
    migrationsDirectoryPath: string
    prismaSchema: string
  }
  export interface EvaluateDataLossInput {
    migrationsDirectoryPath: string
    prismaSchema: string
  }
  export interface CreateMigrationInput {
    migrationsDirectoryPath: string
    prismaSchema: string
    draft: boolean // if true, always generate a migration, but do not apply
    /// The user-given name for the migration. This will be used in the migration directory.
    migrationName?: string
  }
  export interface ApplyMigrationsInput {
    migrationsDirectoryPath: string
  }

  export interface SchemaPush {
    schema: string
    force: boolean
  }
  export interface DropDatabase {
    schema: string
  }
  export interface ApplyMigration {
    migrationId: string
    steps: DatamodelStep[]
    force: boolean
    sourceConfig: string
  }
  export interface InferMigrationSteps {
    migrationId: string
    datamodel: string
    assumeToBeApplied: DatamodelStep[]
    sourceConfig: string
  }
  export interface MigrationProgress {
    migrationId: string
    sourceConfig: string
  }
  export interface CalculateDatabaseSteps {
    assumeToBeApplied: DatamodelStep[]
    stepsToApply: DatamodelStep[]
    sourceConfig: string
  }
  /**
   * These don't
   */
  export interface CalculateDatamodel {
    steps: DatamodelStep[]
  }
  export interface UnapplyMigration {
    sourceConfig: string
  }
  export interface ListMigrations {
    sourceConfig: string
  }
}

// eslint-disable-next-line @typescript-eslint/no-namespace
export namespace EngineResults {
  export interface ListMigrationDirectoriesOutput {
    migrations: string[]
  }
  export interface DiagnoseMigrationHistoryOutput {
    /// Null means no drift was detected.
    drift: DriftDiagnostic | null
    /// Null means the database and the migrations directory are in sync and up to date.
    history: HistoryDiagnostic | null
    /// The name of the migrations that failed to apply completely to the database.
    failedMigrationNames: string[]
    /// The names of the migrations that were edited after they were applied to the database.
    editedMigrationNames: string[]
    /// Whether the migrations table is present.
    hasMigrationsTable: boolean
    /// An optional error encountered when applying a migration that is not
    /// applied in the main database to the shadow database. We do this to
    /// validate that unapplied migrations are at least minimally valid.
    errorInUnappliedMigration: UserFacingError | null
  }

  export interface PlanMigrationOutput {
    // Todo
  }
  export interface EvaluateDataLossOutput {
    /// The migration steps that would be generated. If this is 0, we wouldn't generate a new migration, unless the `draft` option is passed.
    migrationSteps: string[]

    /// The warnings and unexecutable migration messages that apply to the _development database_.
    /// The warnings for the production databases are written as comments into the migration scripts.
    warnings: MigrationFeedback[]
    unexecutableSteps: MigrationFeedback[]
  }
  export interface CreateMigrationOutput {
    /// The name of the newly generated migration directory, if any.
    generatedMigrationName: string | null
  }
  export interface ApplyMigrationsOutput {
    appliedMigrationNames: string[]
  }

  export interface SchemaPush {
    executedSteps: number
    warnings: string[]
    unexecutable: string[]
  }
  export interface InferMigrationSteps {
    datamodelSteps: DatamodelStep[]
    databaseSteps: any[]
    warnings: any[]
    errors: any[]
    generalErrors: any[]
    unexecutableMigrations: UnexecutableMigration[]
  }
  export enum MigrationStatus {
    MigrationSuccess = 'MigrationSuccess',
    MigrationInProgress = 'MigrationInProgress',
    MigrationFailure = 'MigrationFailure',
    Pending = 'Pending',
    RollingBack = 'RollingBack',
    RollbackSuccess = 'RollbackSuccess',
    RollbackFailure = 'RollbackFailure',
  }
  export interface MigrationProgress {
    status: MigrationStatus
    steps: number
    applied: number
    rolledBack: number
    errors: any[]
    startedAt: string
    finishedAt: string
  }
  export interface ApplyMigration {
    datamodelSteps: DatamodelStep[]
    databaseSteps: DatabaseSteps[]
    warnings: Warning[]
    errors: any[]
    generalErrors: any[]
    unexecutableMigrations: UnexecutableMigration[]
  }

  export interface Warning {
    description: string
  }

  export interface UnapplyMigration {
    rolledBack: DatamodelStep[]
    active: DatamodelStep[]
    errors: any[]
  }
  export interface StoredMigration {
    id: string
    datamodelSteps: DatamodelStep[]
    databaseSteps: DatabaseSteps[]
    status: MigrationStatus
    datamodel: string
  }
  export interface CalculateDatamodel {
    datamodel: string
  }
  export type ListMigrations = StoredMigration[]
}

export type ConnectorType = 'mysql' | 'mongo' | 'sqlite' | 'postgresql'

export interface GeneratorConfig {
  name: string
  output: string | null
  provider: string
  config: Dictionary<string>
}

export interface FileMap {
  [fileName: string]: string
}

export interface LockFile {
  localMigrations: string[]
  remoteMigrations: string[]
  localBranch?: string
  remoteBranch?: string
  // TODO: add the conflicts here
}

export interface Dictionary<T> {
  [key: string]: T
}

export interface LocalMigration extends Migration {
  afterFilePath?: string
  beforeFilePath?: string
}

export interface Migration {
  id: string
  datamodelSteps: DatamodelStep[]
  databaseSteps?: DatabaseSteps[]
  datamodel: string
}

export interface DatabaseSteps {
  step: DatabaseStep
  raw: string
}

export interface LocalMigrationWithDatabaseSteps extends LocalMigration {
  databaseSteps: DatabaseSteps[]
  warnings: EngineResults.Warning[]
  unexecutableMigrations: UnexecutableMigration[]
}

export interface RawSqlStep {
  RawSql: string
}

export interface DropTableStep {
  DropTable: {
    name: string
  }
}

export interface RenameTableStep {
  RenameTable: {
    name: string
    new_name: string
  }
}

export interface CreateTableStep {
  CreateTable: {
    name: string
    columns: CreateColumn[]
    primary_columns: string[]
  }
}

export interface CreateColumn {
  name: string
  tpe: string
  required: boolean
  foreign_key: null | {
    table: string
    column: string
  }
}

export type DatabaseStep =
  | RawSqlStep
  | DropTableStep
  | RenameTableStep
  | CreateTableStep
