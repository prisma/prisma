import { type MigrateTypes } from '@prisma/internals'

import type { EngineArgs, EngineResults } from './types'

export interface SchemaEngine {
  isRunning: boolean

  /**
   * Apply the migrations from the migrations directory to the database.
   * This is the command behind prisma migrate deploy.
   */
  applyMigrations(input: EngineArgs.ApplyMigrationsInput): Promise<EngineResults.ApplyMigrationsOutput>

  /**
   * Create the logical database from the Prisma schema.
   */
  createDatabase?(input: EngineArgs.CreateDatabaseInput): Promise<EngineResults.CreateDatabaseOutput>

  /**
   * Create the next migration in the migrations history.
   * If draft is false and there are no unexecutable steps, it will also apply the newly created migration.
   * Note: This will use the shadow database on the connectors where we need one.
   */
  createMigration(input: EngineArgs.CreateMigrationInput): Promise<EngineResults.CreateMigrationOutput>

  /**
   * Execute a database script directly on the specified live database.
   * Note that this may not be defined on all connectors.
   */
  dbExecute(input: EngineArgs.DbExecuteInput): Promise<EngineResults.DbExecuteOutput>

  /**
   * Make the Schema engine panic. Only useful to test client error handling.
   */
  debugPanic(): Promise<void>

  /**
   * The method called at the beginning of migrate dev to decide the course of action,
   * based on the current state of the workspace.
   * It acts as a wrapper around diagnoseMigrationHistory.
   * Its role is to interpret the diagnostic output,
   * and translate it to a concrete action to be performed by the CLI.
   */
  devDiagnostic(input: EngineArgs.DevDiagnosticInput): Promise<EngineResults.DevDiagnosticOutput>

  /**
   * Read the contents of the migrations directory and the migrations table, and returns their relative statuses.
   * At this stage, the Schema engine only reads,
   * it does not write to the database nor the migrations directory, nor does it use a shadow database.
   */
  diagnoseMigrationHistory(
    input: EngineArgs.DiagnoseMigrationHistoryInput,
  ): Promise<EngineResults.DiagnoseMigrationHistoryOutput>

  /**
   * Make sure the Schema engine can connect to the database from the Prisma schema.
   */
  ensureConnectionValidity(input: EngineArgs.EnsureConnectionValidityInput): Promise<void>

  /**
   * Development command for migrations.
   * Evaluate the data loss induced by the next migration the engine would generate on the main database.
   */
  evaluateDataLoss(input: EngineArgs.EvaluateDataLossInput): Promise<EngineResults.EvaluateDataLossOutput>

  /**
   * Get the database version for error reporting.
   * If no argument is given, the version of the database associated to the Prisma schema provided
   * in the constructor will be returned.
   */
  getDatabaseVersion(args?: MigrateTypes.GetDatabaseVersionParams): Promise<string>

  /**
   * Given a Prisma schema, introspect the database definitions and update the schema with the results.
   * `compositeTypeDepth` is optional, and only required for MongoDB.
   */
  introspect(input: EngineArgs.IntrospectParams & { viewsDirectoryPath: string }): Promise<EngineArgs.IntrospectResult>

  /**
   * Compares two databases schemas from two arbitrary sources,
   * and display the difference as either a human-readable summary,
   * or an executable script that can be passed to dbExecute.
   * Connection to a shadow database is only necessary when either the from or the to params is a migrations directory.
   * Diffs have a direction. Which source is from and which is to matters.
   * The resulting diff should be thought of as a migration from the schema in `args.from` to the schema in `args.to`.
   * By default, we output a human-readable diff. If you want an executable script, pass the "script": true param.
   */
  migrateDiff(input: EngineArgs.MigrateDiffInput): Promise<EngineResults.MigrateDiffOutput>

  /**
   * Mark a migration as applied in the migrations table.
   * There are two possible outcomes:
   * - The migration is already in the table, but in a failed state. In this case, we will mark it as rolled back, then create a new entry.
   * - The migration is not in the table. We will create a new entry in the migrations table. The started_at and finished_at will be the same.
   * If it is already applied, we return a user-facing error.
   */
  markMigrationApplied(input: EngineArgs.MarkMigrationAppliedInput): Promise<void>

  /**
   * Mark an existing failed migration as rolled back in the migrations table. It will still be there, but ignored for all purposes except as audit trail.
   */
  markMigrationRolledBack(input: EngineArgs.MarkMigrationRolledBackInput): Promise<void>

  /**
   * Try to make the database empty: no data and no schema.
   * On most connectors, this is implemented by dropping and recreating the database.
   * If that fails (most likely because of insufficient permissions),
   * the engine attempts a “best effort reset” by inspecting the contents of the database and dropping them individually.
   * Drop and recreate the database. The migrations will not be applied, as it would overlap with applyMigrations.
   */
  reset(input: EngineArgs.MigrateResetInput): Promise<void>

  /**
   * The command behind db push.
   */
  schemaPush(input: EngineArgs.SchemaPushInput): Promise<EngineResults.SchemaPush>

  /**
   * SQL introspection that powers TypedSQL feature
   * @param args
   * @returns
   */
  introspectSql(input: EngineArgs.IntrospectSqlParams): Promise<EngineResults.IntrospectSqlOutput>

  /**
   * Stop the engine.
   */
  stop(): Promise<void>
}
