import Debug from '@prisma/debug'
import type { ErrorCapturingSqlDriverAdapterFactory } from '@prisma/driver-adapter-utils'
import { ErrorArea, getWasmError, isWasmPanic, RustPanic, SchemaContext, wasm, wasmSchemaEngineLoader } from '@prisma/internals'
import { bold, red } from 'kleur/colors'

import { handleViewsIO } from './views/handleViewsIO'

export interface SchemaEngineWasmOptions {
  schemaContext: SchemaContext
  debug?: boolean
  engine: wasm.SchemaEngineWasm
}

type SchemaEngineMethods = Omit<wasm.SchemaEngineWasm, 'free'>
export type SchemaEngineInput<M extends keyof SchemaEngineMethods> = Parameters<wasm.SchemaEngineWasm[M]>[0]
export type SchemaEngineOutput<M extends keyof SchemaEngineMethods> = ReturnType<wasm.SchemaEngineWasm[M]>

type SchemaEngineWasmSetupInput = {
  adapter: ErrorCapturingSqlDriverAdapterFactory
  schemaContext: SchemaContext
}

// TODOs:
// - [ ] bundle Wasm
// - [x] change `wasm.SchemaEngineWasm`'s constructor to an async static method?
// - [x] unify types generated via tsify-next (there are currently inconsistencies between `undefined` and `null`)
// - [x] re-throw any error
// - [ ] pass "initial schema" from `SchemaContext` to `SchemaEngineWasm` (only useful for `namespaces`?)
// - [ ] re-throw `RustPanic`
// - [ ] extract error codes from engine errors
// - [ ] capture logs (?)

/**
 * Wrapper around `@prisma/schema-engine-wasm`.
 */
export class SchemaEngineWasm {
  private engine: wasm.SchemaEngineWasm
  private schemaContext?: SchemaContext

  private constructor({ debug = false, schemaContext, engine }: SchemaEngineWasmOptions) {
    this.schemaContext = schemaContext
    if (debug) {
      Debug.enable('SchemaEngine*')
    }
    this.engine = engine
  }

  static async setup({ adapter, ...rest }: SchemaEngineWasmSetupInput): Promise<SchemaEngineWasm> {
    const engine = await wasmSchemaEngineLoader.loadSchemaEngine(adapter)
    return new SchemaEngineWasm({ ...rest, engine })
  }

  private runCommand<M extends keyof SchemaEngineMethods>(
    command: M,
    input: SchemaEngineInput<M>,
  ): SchemaEngineOutput<M> {
    try {
      const fn = this.engine[command] as (input: SchemaEngineInput<M>) => SchemaEngineOutput<M>
      return fn(input)
    } catch (e) {
      console.error('[schema-engine] error on command %s:\n%s', command, e)

      if (isWasmPanic(e)) {
        const { message, stack } = getWasmError(e)
        // Handle error and displays the interactive dialog to send panic error
        throw new RustPanic(serializePanic(message), stack, command, ErrorArea.LIFT_CLI)
      }

      throw e
    }
  }

  /**
   * Apply the migrations from the migrations directory to the database.
   * This is the command behind prisma migrate deploy.
   */
  public applyMigrations(input: SchemaEngineInput<'applyMigrations'>): SchemaEngineOutput<'applyMigrations'> {
    return this.runCommand('applyMigrations', input)
  }

  /**
   * Create the next migration in the migrations history.
   * If draft is false and there are no unexecutable steps, it will also apply the newly created migration.
   * Note: This will use the shadow database on the connectors where we need one.
   */
  public createMigration(input: SchemaEngineInput<'createMigration'>): SchemaEngineOutput<'createMigration'> {
    return this.runCommand('createMigration', input)
  }

  /**
   * Execute a database script directly on the specified live database.
   * Note that this may not be defined on all connectors.
   */
  public dbExecute(input: SchemaEngineInput<'dbExecute'>): SchemaEngineOutput<'dbExecute'> {
    return this.runCommand('dbExecute', input)
  }

  /**
   * Make the Schema engine panic. Only useful to test client error handling.
   */
  public debugPanic() {
    this.runCommand('debugPanic', undefined)
  }

  /**
   * The method called at the beginning of migrate dev to decide the course of action,
   * based on the current state of the workspace.
   * It acts as a wrapper around diagnoseMigrationHistory.
   * Its role is to interpret the diagnostic output,
   * and translate it to a concrete action to be performed by the CLI.
   */
  public devDiagnostic(input: SchemaEngineInput<'devDiagnostic'>): SchemaEngineOutput<'devDiagnostic'> {
    return this.runCommand('devDiagnostic', input)
  }

  /**
   * Read the contents of the migrations directory and the migrations table, and returns their relative statuses.
   * At this stage, the Schema engine only reads,
   * it does not write to the database nor the migrations directory, nor does it use a shadow database.
   */
  public diagnoseMigrationHistory(
    input: SchemaEngineInput<'diagnoseMigrationHistory'>,
  ): SchemaEngineOutput<'diagnoseMigrationHistory'> {
    return this.runCommand('diagnoseMigrationHistory', input)
  }

  /**
   * Make sure the Schema engine can connect to the database from the Prisma schema.
   */
  public ensureConnectionValidity(
    input: SchemaEngineInput<'ensureConnectionValidity'>,
  ): SchemaEngineOutput<'ensureConnectionValidity'> {
    return this.runCommand('ensureConnectionValidity', input)
  }

  /**
   * Development command for migrations.
   * Evaluate the data loss induced by the next migration the engine would generate on the main database.
   */
  public evaluateDataLoss(input: SchemaEngineInput<'evaluateDataLoss'>): SchemaEngineOutput<'evaluateDataLoss'> {
    return this.runCommand('evaluateDataLoss', input)
  }

  public getDatabaseDescription(_schema: string): Promise<string> {
    // TODO: add `getDatabaseDescription` to @prisma/schema-engine-wasm
    throw new Error('Not implemented')
  }

  /**
   * Get the database version for error reporting.
   * If no argument is given, the version of the database associated to the Prisma schema provided
   * in the constructor will be returned.
   */
  public getDatabaseVersion(input?: SchemaEngineInput<'version'>): SchemaEngineOutput<'version'> {
    return this.runCommand('version', input)
  }

  /**
   * Given a Prisma schema, introspect the database definitions and update the schema with the results.
   * `compositeTypeDepth` is optional, and only required for MongoDB.
   */
  public async introspect({
    schema,
    force = false,
    baseDirectoryPath,
    viewsDirectoryPath,
    compositeTypeDepth = -1, // cannot be undefined
    namespaces,
  }: SchemaEngineInput<'introspect'> & { viewsDirectoryPath: string }): SchemaEngineOutput<'introspect'> {
    const introspectResult = await this.runCommand('introspect', {
      schema,
      force,
      compositeTypeDepth,
      namespaces,
      baseDirectoryPath,
    })
    const { views } = introspectResult

    if (views) {
      await handleViewsIO({ views, viewsDirectoryPath })
    }

    return introspectResult
  }

  /**
   * Compares two databases schemas from two arbitrary sources,
   * and display the difference as either a human-readable summary,
   * or an executable script that can be passed to dbExecute.
   * Connection to a shadow database is only necessary when either the from or the to params is a migrations directory.
   * Diffs have a direction. Which source is from and which is to matters.
   * The resulting diff should be thought of as a migration from the schema in `args.from` to the schema in `args.to`.
   * By default, we output a human-readable diff. If you want an executable script, pass the "script": true param.
   */
  public migrateDiff(input: SchemaEngineInput<'diff'>): SchemaEngineOutput<'diff'> {
    return this.runCommand('diff', input)
  }

  /**
   * Mark a migration as applied in the migrations table.
   * There are two possible outcomes:
   * - The migration is already in the table, but in a failed state. In this case, we will mark it as rolled back, then create a new entry.
   * - The migration is not in the table. We will create a new entry in the migrations table. The started_at and finished_at will be the same.
   * If it is already applied, we return a user-facing error.
   */
  public markMigrationApplied(
    input: SchemaEngineInput<'markMigrationApplied'>,
  ): SchemaEngineOutput<'markMigrationApplied'> {
    return this.runCommand('markMigrationApplied', input)
  }

  /**
   * Mark an existing failed migration as rolled back in the migrations table. It will still be there, but ignored for all purposes except as audit trail.
   */
  public markMigrationRolledBack(
    input: SchemaEngineInput<'markMigrationRolledBack'>,
  ): SchemaEngineOutput<'markMigrationRolledBack'> {
    return this.runCommand('markMigrationRolledBack', input)
  }

  /**
   * Try to make the database empty: no data and no schema.
   * On most connectors, this is implemented by dropping and recreating the database.
   * If that fails (most likely because of insufficient permissions),
   * the engine attempts a “best effort reset” by inspecting the contents of the database and dropping them individually.
   * Drop and recreate the database. The migrations will not be applied, as it would overlap with applyMigrations.
   */
  public async reset() {
    await this.runCommand('reset', undefined)
  }

  /**
   * The command behind db push.
   */
  public schemaPush(input: SchemaEngineInput<'schemaPush'>): SchemaEngineOutput<'schemaPush'> {
    return this.runCommand('schemaPush', input)
  }

  /**
   * SQL introspection that powers TypedSQL feature
   * @param args
   * @returns
   */
  public introspectSql(input: SchemaEngineInput<'introspectSql'>): SchemaEngineOutput<'introspectSql'> {
    return this.runCommand('introspectSql', input)
  }
}

/** The full message with context we return to the user in case of engine panic. */
function serializePanic(log: string): string {
  return `${red(bold('Error in Schema engine.\nReason: '))}${log}\n`
}
