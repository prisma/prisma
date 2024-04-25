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

export type Query = {
  sql: string
  args: Array<unknown>
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
      kind: 'Postgres'
      code: string
      severity: string
      message: string
      detail: string | undefined
      column: string | undefined
      hint: string | undefined
    }
  | {
      kind: 'Mysql'
      code: number
      message: string
      state: string
    }
  | {
      kind: 'Sqlite'
      /**
       * Sqlite extended error code: https://www.sqlite.org/rescode.html
       */
      extendedCode: number
      message: string
    }

export type ConnectionInfo = {
  schemaName?: string
}

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

export interface Queryable {
  readonly provider: 'mysql' | 'postgres' | 'sqlite'
  readonly adapterName: (typeof officialPrismaAdapters)[number] | (string & {})

  /**
   * Execute a query given as SQL, interpolating the given parameters,
   * and returning the type-aware result set of the query.
   *
   * This is the preferred way of executing `SELECT` queries.
   */
  queryRaw(params: Query): Promise<Result<ResultSet>>

  /**
   * Execute a query given as SQL, interpolating the given parameters,
   * and returning the number of affected rows.
   *
   * This is the preferred way of executing `INSERT`, `UPDATE`, `DELETE` queries,
   * as well as transactional queries.
   */
  executeRaw(params: Query): Promise<Result<number>>
}

export interface DriverAdapter extends Queryable {
  /**
   * Starts new transaction.
   */
  startTransaction(): Promise<Result<Transaction>>

  /**
   * Optional method that returns extra connection info
   */
  getConnectionInfo?(): Result<ConnectionInfo>
}

export type TransactionOptions = {
  usePhantomQuery: boolean
}

export interface Transaction extends Queryable {
  /**
   * Transaction options.
   */
  readonly options: TransactionOptions
  /**
   * Commit the transaction.
   */
  commit(): Promise<Result<void>>
  /**
   * Rolls back the transaction.
   */
  rollback(): Promise<Result<void>>
}

export interface ErrorCapturingDriverAdapter extends DriverAdapter {
  readonly errorRegistry: ErrorRegistry
}

export interface ErrorRegistry {
  consumeError(id: number): ErrorRecord | undefined
}

export type ErrorRecord = { error: unknown }
