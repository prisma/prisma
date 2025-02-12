import { ColumnTypeEnum } from './const'
import { Result } from './result'

export type ColumnType = (typeof ColumnTypeEnum)[keyof typeof ColumnTypeEnum]

export interface ResultSet {
  /**
   * List of column types appearing in a database query, in the same order as `columnNames`.
   * They are used within the Query Engine to convert values from JS to Quaint values.
   */
  columnTypes: Array<ColumnType>

  /**
   * List of column names appearing in a database query, in the same order as `columnTypes`.
   */
  columnNames: Array<string>

  /**
   * List of rows retrieved from a database query.
   * Each row is a list of values, whose length matches `columnNames` and `columnTypes`.
   */
  rows: Array<Array<unknown>>

  /**
   * The last ID of an `INSERT` statement, if any.
   * This is required for `AUTO_INCREMENT` columns in databases based on MySQL and SQLite.
   */
  lastInsertId?: string
}

/**
 * Original `quaint::ValueType` enum tag from Prisma's `quaint`.
 * Query arguments marked with this type are sanitized before being sent to the database.
 * Notice while a query argument may be `null`, `ArgType` is guaranteed to be defined.
 */
export type ArgType =
  // 32-bit signed integer.
  | 'Int32'
  // 64-bit signed integer.
  | 'Int64'
  // 32-bit floating point.
  | 'Float'
  // 64-bit floating point.
  | 'Double'
  // String value.
  | 'Text'
  // Database enum value.
  | 'Enum'
  // Database enum array (PostgreSQL specific).
  | 'EnumArray'
  // Bytes value.
  | 'Bytes'
  // Boolean value.
  | 'Boolean'
  // A single character.
  | 'Char'
  // An array value (PostgreSQL).
  | 'Array'
  // A numeric value.
  | 'Numeric'
  // A JSON value.
  | 'Json'
  // A XML value.
  | 'Xml'
  // An UUID value.
  | 'Uuid'
  // A datetime value.
  | 'DateTime'
  // A date value.
  | 'Date'
  // A time value.
  | 'Time'

export type Query = {
  sql: string
  args: Array<unknown>
  argTypes: Array<ArgType>
}

export type Error =
  | {
      kind: 'GenericJs'
      id: number
    }
  | {
      kind: 'UnsupportedNativeDataType'
      type: string
    }
  | {
      kind: 'postgres'
      code: string
      severity: string
      message: string
      detail: string | undefined
      column: string | undefined
      hint: string | undefined
    }
  | {
      kind: 'mysql'
      code: number
      message: string
      state: string
    }
  | {
      kind: 'sqlite'
      /**
       * Sqlite extended error code: https://www.sqlite.org/rescode.html
       */
      extendedCode: number
      message: string
    }

export type ConnectionInfo = {
  schemaName?: string
  maxBindValues?: number
}

export type Provider = 'mysql' | 'postgres' | 'sqlite'

// Current list of official Prisma adapters
// This list might get outdated over time.
// It's only used for auto-completion.
const officialPrismaAdapters = [
  '@prisma/adapter-planetscale',
  '@prisma/adapter-neon',
  '@prisma/adapter-libsql',
  '@prisma/adapter-d1',
  '@prisma/adapter-pg',
  '@prisma/adapter-pg-worker',
] as const

type ErrorCapturingInterface<T> = {
  [K in keyof T]: T[K] extends (...args: infer A) => Promise<infer R>
    ? (...args: A) => Promise<Result<ErrorCapturingInterface<R>>>
    : T[K]
}

export interface SqlConnection {
  /**
   * Execute a query given as SQL, interpolating the given parameters,
   * and returning the type-aware result set of the query.
   *
   * This is the preferred way of executing `SELECT` queries.
   */
  queryRaw(params: Query): Promise<ResultSet>

  /**
   * Execute a query given as SQL, interpolating the given parameters,
   * and returning the number of affected rows.
   *
   * This is the preferred way of executing `INSERT`, `UPDATE`, `DELETE` queries,
   * as well as transactional queries.
   */
  executeRaw(params: Query): Promise<number>

  /**
   * Execute multiple SQL statements separated by semicolon.
   */
  executeScript(script: string): Promise<void>

  /**
   * Dispose of the connection and release any resources.
   */
  dispose(): Promise<void>
}

export interface SqlAdapter {
  readonly provider: Provider
  readonly adapterName: (typeof officialPrismaAdapters)[number] | (string & {})
}

export interface SqlQueryAdapter extends SqlConnection, SqlAdapter {
  /**
   * Starts new transaction.
   */
  transactionContext(): Promise<TransactionContext>

  /**
   * Optional method that returns extra connection info
   */
  getConnectionInfo?(): ConnectionInfo
}

export interface SqlMigrationAdapter extends SqlAdapter {
  /**
   * Creates a connection to the database that the adapter is configured to connect to.
   */
  connect(): Promise<SqlConnection>

  /**
   * Creates a connection to the shadow database that the adapter is configured to connect to or
   * a transient database if no shadow database is configured.
   */
  connectToShadowDb(): Promise<SqlConnection>
}

export interface TransactionContext extends SqlAdapter, SqlConnection {
  /**
   * Starts new transaction.
   */
  startTransaction(): Promise<Transaction>
}

export type TransactionOptions = {
  usePhantomQuery: boolean
}

export interface Transaction extends SqlAdapter, SqlConnection {
  /**
   * Transaction options.
   */
  readonly options: TransactionOptions
  /**
   * Commit the transaction.
   */
  commit(): Promise<void>
  /**
   * Rolls back the transaction.
   */
  rollback(): Promise<void>
}

export interface ErrorCapturingDriverAdapter extends ErrorCapturingInterface<SqlQueryAdapter> {
  readonly errorRegistry: ErrorRegistry
}

export type ErrorCapturingTransactionContext = ErrorCapturingInterface<TransactionContext>

export type ErrorCapturingTransaction = ErrorCapturingInterface<Transaction>

export type ErrorCapturingQueryable = ErrorCapturingInterface<SqlConnection>

export interface ErrorRegistry {
  consumeError(id: number): ErrorRecord | undefined
}

export type ErrorRecord = { error: unknown }
