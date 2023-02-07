// See engine's JSON RPC types
// https://prisma.github.io/prisma-engines/doc/migration_core/json_rpc/types/index.html
//
// https://www.jsonrpc.org/specification
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

// The URL of the database to run the command on.
type UrlContainer = {
  tag: 'ConnectionString'
  url: string
}
// Path to the Prisma schema file to take the datasource URL from.
type PathContainer = {
  tag: 'SchemaPath'
  path: string
}
// Prisma schema as string
type SchemaContainer = {
  tag: 'SchemaString'
  schema: string
}
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
    prismaSchema: string
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
    datasource: SchemaContainer | UrlContainer | PathContainer
  }

  export interface DropDatabase {
    schema: string
  }

  type DbExecuteDatasourceTypeSchema = {
    // Path to the Prisma schema file to take the datasource URL from.
    tag: 'schema'
    schema: string
  }
  type DbExecuteDatasourceTypeUrl = {
    // The URL of the database to run the command on.
    tag: 'url'
    url: string
  }
  export type DbExecuteDatasourceType = DbExecuteDatasourceTypeSchema | DbExecuteDatasourceTypeUrl
  export interface DbExecuteInput {
    // The location of the live database to connect to.
    datasourceType: DbExecuteDatasourceType
    // The input script.
    script: string
  }

  export interface GetDatabaseVersionParams {
    schema: string
  }

  export interface IntrospectParams {
    schema: string
    force?: Boolean

    // Note: this must be a non-negative integer
    compositeTypeDepth?: number
    schemas?: string[]
  }
  export interface IntrospectResult {
    datamodel: string
    warnings: IntrospectionWarnings[]
    version: IntrospectionSchemaVersion
  }

  // See prisma-engines
  // SQL databases:
  // Previously at https://github.com/prisma/prisma-engines/blob/main/introspection-engine/connectors/sql-introspection-connector/src/warnings.rs
  // Now at https://github.com/prisma/prisma-engines/blob/main/introspection-engine/connectors/sql-introspection-connector/src/warnings/generators.rs
  //
  // MongoDB:
  // https://github.com/prisma/prisma-engines/blob/main/introspection-engine/connectors/mongodb-introspection-connector/src/warnings.rs

  export type IntrospectionWarnings =
    | IntrospectionWarningsUnhandled
    | IntrospectionWarningsInvalidReintro
    | IntrospectionWarningsMissingUnique
    | IntrospectionWarningsEmptyFieldName
    | IntrospectionWarningsUnsupportedType
    | IntrospectionWarningsInvalidEnumName
    | IntrospectionWarningsCuidPrisma1
    | IntrospectionWarningsUuidPrisma1
    | IntrospectionWarningsFieldModelReintro
    | IntrospectionWarningsFieldMapReintro
    | IntrospectionWarningsEnumMapReintro
    | IntrospectionWarningsEnumValueMapReintro
    | IntrospectionWarningsWithoutColumns
    | IntrospectionWarningsCustomIndexNameReintro
    | IntrospectionWarningsCustomPrimaryKeyNamesReintro
    | IntrospectionWarningsRelationsReintro
    | IntrospectionWarningsTopLevelItemNameIsADupe
    // MongoDB below
    | IntrospectionWarningsMongoMultipleTypes
    | IntrospectionWarningsMongoFieldsPointingToAnEmptyType
    | IntrospectionWarningsMongoFieldsWithUnknownTypes
    | IntrospectionWarningsMongoFieldsWithEmptyNames

  type AffectedTopLevel = { type: 'Model' | 'Enum'; name: string }
  type AffectedModel = { model: string }
  type AffectedModelAndIndex = { model: string; index_db_name: string }
  type AffectedModelAndField = { model: string; field: string }
  type AffectedModelAndFieldAndType = {
    model: string
    field: string
    tpe: string
  }
  type AffectedModelOrCompositeTypeAndField = {
    // TODO: add discriminated union
    // Either compositeType or model is defined
    compositeType?: string
    model?: string
    field: string
  }

  type AffectedModelOrCompositeTypeAndFieldAndType = AffectedModelOrCompositeTypeAndField & {
    tpe: string
  }

  type AffectedEnum = { enm: string }
  type AffectedEnumAndValue = { enm: string; value: string }

  interface IntrospectionWarning {
    code: number
    message: string
    affected:
      | AffectedTopLevel[]
      | AffectedModel[]
      | AffectedModelAndIndex[]
      | AffectedModelAndField[]
      | AffectedModelAndFieldAndType[]
      | AffectedModelOrCompositeTypeAndField[]
      | AffectedModelOrCompositeTypeAndFieldAndType[]
      | AffectedEnum[]
      | AffectedEnumAndValue[]
      | null
  }

  interface IntrospectionWarningsUnhandled extends IntrospectionWarning {
    code: -1 // -1 doesn't exist, it's just for the types
    affected: any
  }
  interface IntrospectionWarningsInvalidReintro extends IntrospectionWarning {
    code: 0
    affected: null
  }
  interface IntrospectionWarningsMissingUnique extends IntrospectionWarning {
    code: 1
    affected: AffectedModel[]
  }
  interface IntrospectionWarningsEmptyFieldName extends IntrospectionWarning {
    code: 2
    affected: AffectedModelAndField[]
  }
  interface IntrospectionWarningsUnsupportedType extends IntrospectionWarning {
    code: 3
    affected: AffectedModelAndFieldAndType[]
  }
  interface IntrospectionWarningsInvalidEnumName extends IntrospectionWarning {
    code: 4
    affected: AffectedEnumAndValue[]
  }
  interface IntrospectionWarningsCuidPrisma1 extends IntrospectionWarning {
    code: 5
    affected: AffectedModelAndField[]
  }
  interface IntrospectionWarningsUuidPrisma1 extends IntrospectionWarning {
    code: 6
    affected: AffectedModelAndField[]
  }
  interface IntrospectionWarningsFieldModelReintro extends IntrospectionWarning {
    code: 7
    affected: AffectedModel[]
  }
  interface IntrospectionWarningsFieldMapReintro extends IntrospectionWarning {
    code: 8
    affected: AffectedModelAndField[]
  }
  interface IntrospectionWarningsEnumMapReintro extends IntrospectionWarning {
    code: 9
    affected: AffectedEnum[]
  }
  interface IntrospectionWarningsEnumValueMapReintro extends IntrospectionWarning {
    code: 10
    affected: AffectedEnum[]
  }
  // Note that 11, 12 were removed in
  // https://github.com/prisma/prisma-engines/commit/610625b0588e5b55e4c5116a68ea43b939de76d9
  //
  // Note that 13 was removed in
  // https://github.com/prisma/prisma-engines/commit/5dfd619bdc254a38c54079cc8a238acc224b9bc7
  interface IntrospectionWarningsWithoutColumns extends IntrospectionWarning {
    code: 14
    affected: AffectedModel[]
  }
  // Note that 15, and 16 were removed
  // in https://github.com/prisma/prisma-engines/commit/bffd935029e462592819b33a080e8f8953b58acb
  interface IntrospectionWarningsCustomIndexNameReintro extends IntrospectionWarning {
    code: 17
    affected: AffectedModelAndIndex[]
  }
  interface IntrospectionWarningsCustomPrimaryKeyNamesReintro extends IntrospectionWarning {
    code: 18
    affected: AffectedModel[]
  }
  interface IntrospectionWarningsRelationsReintro extends IntrospectionWarning {
    code: 19
    affected: AffectedModel[]
  }
  interface IntrospectionWarningsTopLevelItemNameIsADupe extends IntrospectionWarning {
    code: 20
    affected: AffectedTopLevel[]
  }

  // MongoDB starts at 101 see
  // https://github.com/prisma/prisma-engines/blob/main/introspection-engine/connectors/mongodb-introspection-connector/src/warnings.rs#L39-L43
  interface IntrospectionWarningsMongoMultipleTypes extends IntrospectionWarning {
    code: 101
    affected: AffectedModelOrCompositeTypeAndFieldAndType[]
  }
  interface IntrospectionWarningsMongoFieldsPointingToAnEmptyType extends IntrospectionWarning {
    code: 102
    affected: AffectedModelOrCompositeTypeAndField[]
  }
  interface IntrospectionWarningsMongoFieldsWithUnknownTypes extends IntrospectionWarning {
    code: 103
    affected: AffectedModelOrCompositeTypeAndField[]
  }
  interface IntrospectionWarningsMongoFieldsWithEmptyNames extends IntrospectionWarning {
    code: 104
    affected: AffectedModelOrCompositeTypeAndField[]
  }

  export type IntrospectionSchemaVersion = 'Prisma2' | 'Prisma1' | 'Prisma11' | 'NonPrisma'

  export interface DevDiagnosticInput {
    migrationsDirectoryPath: string
  }

  export interface DiagnoseMigrationHistoryInput {
    migrationsDirectoryPath: string
    /// Whether creating shadow/temporary databases is allowed.
    optInToShadowDatabase: boolean
  }

  export interface EnsureConnectionValidityInput {
    datasource: SchemaContainer | UrlContainer | PathContainer
  }

  export interface EvaluateDataLossInput {
    migrationsDirectoryPath: string
    prismaSchema: string
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

  type MigrateDiffTargetUrl = {
    // The url to a live database. Its schema will be considered.
    // This will cause the migration engine to connect to the database and read from it. It will not write.
    tag: 'url'
    url: string
  }
  type MigrateDiffTargetEmpty = {
    // An empty schema.
    tag: 'empty'
  }
  type MigrateDiffTargetSchemaDatamodel = {
    // Path to the Prisma schema file to take the datasource URL from.
    tag: 'schemaDatamodel'
    schema: string
  }
  type MigrateDiffTargetSchemaDatasource = {
    // The path to a Prisma schema.
    // The datasource url will be considered, and the live database it points to introspected for its schema.
    tag: 'schemaDatasource'
    schema: string
  }
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

  export interface SchemaPush {
    schema: string
    force: boolean
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
}

export interface FileMap {
  [fileName: string]: string
}

export interface Dictionary<T> {
  [key: string]: T
}
