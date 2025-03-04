// See engine's JSON RPC types
// https://prisma.github.io/prisma-engines/doc/migration_core/json_rpc/types/index.html
//
// https://www.jsonrpc.org/specification

import type { SqlQueryOutput } from '@prisma/generator-helper'
import type { MigrateTypes } from '@prisma/internals'

import type { IntrospectionViewDefinition } from './views/handleViewsIO'

// A JSON-RPC request or response.
export interface RpcRequestResponse {
  id: number
  jsonrpc: '2.0'
}

// should this be result: T; error: never? (and same below)
export interface RpcSuccessResponse<T> extends RpcRequestResponse {
  result: T
}

interface RpcErrorResponse<T> extends RpcRequestResponse {
  error: T
}

export type RpcResponse<T, E> = RpcSuccessResponse<T> | RpcErrorResponse<E>

export interface RPCPayload extends RpcRequestResponse {
  method: string
  params: any
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

export type DevAction = { tag: 'reset'; reason: string } | { tag: 'createMigration' }

// eslint-disable-next-line @typescript-eslint/no-namespace
export namespace EngineArgs {
  /**
   * These RPCs need a sourceConfig, therefore a db connection to function
   */
  export interface ApplyMigrationsInput {
    migrationsDirectoryPath: string
  }

  export interface CreateMigrationInput {
    migrationsDirectoryPath: string
    schema: MigrateTypes.SchemasContainer
    draft: boolean // if true, always generate a migration, but do not apply
    /// The user-given name for the migration. This will be used in the migration directory.
    migrationName?: string
  }

  // The path to a live database taken as input.
  // For flexibility,
  // this can be the path to a Prisma schema file containing the datasource,
  // or the whole Prisma schema as a string,
  // or only the connection string.
  export interface CreateDatabaseInput {
    datasource: MigrateTypes.DatasourceParam
  }

  export interface DropDatabase {
    schema: string
  }

  export type DbExecuteDatasourceType =
    | MigrateTypes.Tagged<'schema', MigrateTypes.SchemasWithConfigDir>
    | MigrateTypes.Tagged<'url', MigrateTypes.UrlContainer>
  export interface DbExecuteInput {
    // The location of the live database to connect to.
    datasourceType: DbExecuteDatasourceType
    // The input script.
    script: string
  }

  export interface IntrospectParams {
    schema: MigrateTypes.SchemasContainer
    baseDirectoryPath: string
    force?: boolean

    // Note: this must be a non-negative integer
    compositeTypeDepth?: number
    namespaces?: string[]
  }

  export interface IntrospectResult {
    schema: MigrateTypes.SchemasContainer
    warnings: string | null

    /**
     * Views retrieved from the databases.
     * Supported databases: 'postgresql'.
     *
     * This value is:
     * - `null` if "views" doesn't appear in the schema's preview features
     * - `[]` if the database doesn't have any views
     * - a non-empty array in other cases
     */
    views: IntrospectionViewDefinition[] | null
  }

  export interface DevDiagnosticInput {
    migrationsDirectoryPath: string
  }

  export interface DiagnoseMigrationHistoryInput {
    migrationsDirectoryPath: string
    /// Whether creating shadow/temporary databases is allowed.
    optInToShadowDatabase: boolean
  }

  export interface EnsureConnectionValidityInput {
    datasource: MigrateTypes.DatasourceParam
  }

  export interface EvaluateDataLossInput {
    migrationsDirectoryPath: string
    schema: MigrateTypes.SchemasContainer
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

  type MigrateDiffTargetUrl = MigrateTypes.Tagged<'url', MigrateTypes.UrlContainer>
  type MigrateDiffTargetEmpty = {
    // An empty schema.
    tag: 'empty'
  }
  type MigrateDiffTargetSchemaDatamodel = MigrateTypes.Tagged<'schemaDatamodel', MigrateTypes.SchemasContainer>
  type MigrateDiffTargetSchemaDatasource = MigrateTypes.Tagged<'schemaDatasource', MigrateTypes.SchemasWithConfigDir>
  type MigrateDiffTargetMigrations = {
    // The path to a migrations directory of the shape expected by Prisma Migrate.
    // The migrations will be applied to a shadow database, and the resulting schema considered for diffing.
    tag: 'migrations'
    path: string
  }
  export type MigrateDiffTarget =
    | MigrateDiffTargetUrl
    | MigrateDiffTargetEmpty
    | MigrateDiffTargetSchemaDatamodel
    | MigrateDiffTargetSchemaDatasource
    | MigrateDiffTargetMigrations
  export interface MigrateDiffInput {
    // The source of the schema to consider as a starting point.
    from: MigrateDiffTarget
    // The source of the schema to consider as a destination, or the desired end-state.
    to: MigrateDiffTarget
    // By default, the response will contain a human-readable diff.
    // If you want an executable script, pass the "script": true param.
    script: boolean
    // The URL to a live database to use as a shadow database. The schema and data on that database will be wiped during diffing.
    // This is only necessary when one of from or to is referencing a migrations directory as a source for the schema.
    shadowDatabaseUrl?: string
    // Change the exit code behavior when diff is not empty
    // Empty: 0, Error: 1, Non empty: 2
    exitCode?: boolean
  }

  export interface SchemaPushInput {
    schema: MigrateTypes.SchemasContainer
    force: boolean
  }

  export interface IntrospectSqlParams {
    url: string
    queries: SqlQueryInput[]
  }

  export interface SqlQueryInput {
    name: string
    source: string
  }
}

// eslint-disable-next-line @typescript-eslint/no-namespace
export namespace EngineResults {
  export interface ApplyMigrationsOutput {
    appliedMigrationNames: string[]
  }

  export interface CreateDatabaseOutput {
    database_name: string
  }

  export interface CreateMigrationOutput {
    /// The name of the newly generated migration directory, if any.
    generatedMigrationName: string | null
  }

  export interface DbExecuteOutput {}

  export interface DevDiagnosticOutput {
    action: DevAction
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

  export interface EvaluateDataLossOutput {
    /// The number of migration steps that would be generated. If this is 0, we wouldn't generate a new migration, unless the `draft` option is passed.
    migrationSteps: number

    /// The warnings and unexecutable migration messages that apply to the _development database_.
    /// The warnings for the production databases are written as comments into the migration scripts.
    warnings: MigrationFeedback[]
    unexecutableSteps: MigrationFeedback[]
  }

  export interface ListMigrationDirectoriesOutput {
    migrations: string[]
  }

  export enum MigrateDiffExitCode {
    // 0 = success
    // if --exit-code is passed
    // 0 = success with empty diff (no changes)
    SUCCESS = 0,
    // 1 = Error
    ERROR = 1,
    // 2 = Succeeded with non-empty diff (changes present)
    SUCCESS_NONEMPTY = 2,
  }
  export interface MigrateDiffOutput {
    exitCode: MigrateDiffExitCode
  }

  export interface SchemaPush {
    executedSteps: number
    warnings: string[]
    unexecutable: string[]
  }

  export interface IntrospectSqlOutput {
    queries: SqlQueryOutput[]
  }
}

export interface FileMap {
  [fileName: string]: string
}

export interface Dictionary<T> {
  [key: string]: T
}
