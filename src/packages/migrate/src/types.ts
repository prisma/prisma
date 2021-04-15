interface UserFacingError {
  is_panic: boolean
  message: string
  error_code?: string
  meta?: unknown
}

export type UserFacingErrorWithMeta = {
  is_panic: boolean
  message: string
  error_code: 'P3006'
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
  | { diagnostic: 'databaseIsBehind'; unappliedMigrationNames: string[] }
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

export type DevAction =
  | { tag: 'reset'; reason: string }
  | { tag: 'createMigration' }

// eslint-disable-next-line @typescript-eslint/no-namespace
export namespace EngineArgs {
  /**
   * These RPCs need a sourceConfig, therefore a db connection to function
   */
  export interface DevDiagnosticInput {
    migrationsDirectoryPath: string
  }
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
  export interface DiagnoseMigrationHistoryInput {
    migrationsDirectoryPath: string
    /// Whether creating shadow/temporary databases is allowed.
    optInToShadowDatabase: boolean
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
}

// eslint-disable-next-line @typescript-eslint/no-namespace
export namespace EngineResults {
  export interface ListMigrationDirectoriesOutput {
    migrations: string[]
  }
  export interface DiagnoseMigrationHistoryOutput {
    /// Null means the database and the migrations directory are in sync and up to date.
    history: HistoryDiagnostic | null
    /// The name of the migrations that failed to apply completely to the database.
    failedMigrationNames: string[]
    /// The names of the migrations that were modified after they were applied to the database.
    editedMigrationNames: string[]
    /// Whether the migrations table is present.
    hasMigrationsTable: boolean
  }
  export interface DevDiagnosticOutput {
    action: DevAction
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
}

export interface FileMap {
  [fileName: string]: string
}

export interface Dictionary<T> {
  [key: string]: T
}
