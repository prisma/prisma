import { ColumnTypeEnum } from './const'
import { Result } from './result'

export type ColumnType = (typeof ColumnTypeEnum)[keyof typeof ColumnTypeEnum]

export type JSON = Record<string, unknown> // TODO: refine or import one of our existing definitions

export type ResultSet = SQLResultSet | MongoDBResultSet

export interface SQLResultSet {
  kind: 'sql'
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

export interface MongoDBResultSet {
  kind: 'mongodb'
  rows: Array<JSON>
}

// Helper type to automatically infer the correct ResultSet subtype based on the given Query subtype
export type ResultSetFromQuery<T extends Query> = T extends SQLQuery
  ? SQLResultSet
  : T extends MongoDBQuery
  ? MongoDBResultSet
  : ResultSet

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

export type Query = SQLQuery | MongoDBQuery

export type SQLQuery = {
  kind: 'sql'
  sql: string
  args: Array<unknown>
  argTypes: Array<ArgType>
}

export type MongoDBQuery = {
  kind: 'mongodb'
  // The table (aka collection) name.
  collection: string
  // Whether this will return a single document or a cursor to iterate over.
  // The DriverAdapter will have to transform both into an array or numbers of affected rows.
  returnType: 'document' | 'cursor'
  // The actual action on the collection.
  // As per MongoDB docu: https://mongodb.github.io/node-mongodb-native/6.12/classes/Collection.html
  action: 'find' | 'findOne' | 'aggregate' | 'updateOne' | 'insertMany' // ...
  // The query or filter statement.
  // As per MongoDB docu: https://mongodb.github.io/node-mongodb-native/6.12/types/Filter.html
  query?: JSON | JSON[]
  // The data for update or insert operations.
  data?: JSON | JSON[]
  // The options object for the action.
  options?: Record<string, unknown>
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
  maxBindValues?: number
}

// TODO: I don't really like that we call this "flavour" in some places and "provider" in others. :/
export type Flavour = 'mysql' | 'postgres' | 'sqlite' | 'mongodb'

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

export interface Queryable<Q extends Query = Query> {
  readonly provider: Flavour
  readonly adapterName: (typeof officialPrismaAdapters)[number] | (string & {})

  /**
   * Execute a query given as SQL, interpolating the given parameters,
   * and returning the type-aware result set of the query.
   *
   * This is the preferred way of executing `SELECT` queries.
   */
  queryRaw(params: Q): Promise<Result<ResultSetFromQuery<Q>>>

  /**
   * Execute a query given as SQL, interpolating the given parameters,
   * and returning the number of affected rows.
   *
   * This is the preferred way of executing `INSERT`, `UPDATE`, `DELETE` queries,
   * as well as transactional queries.
   */
  executeRaw(params: Q): Promise<Result<number>>
}

export interface TransactionContext<Q extends Query = Query> extends Queryable<Q> {
  /**
   * Starts new transaction.
   */
  startTransaction(): Promise<Result<Transaction<Q>>>
}

export interface DriverAdapter<Q extends Query = Query> extends Queryable<Q> {
  /**
   * Starts new transaction.
   */
  transactionContext(): Promise<Result<TransactionContext<Q>>>

  /**
   * Optional method that returns extra connection info
   */
  getConnectionInfo?(): Result<ConnectionInfo>
}

export interface SQLDriverAdapter extends DriverAdapter<SQLQuery> {
  provider: 'sqlite' | 'mysql' | 'postgres'
}

export interface MongoDBDriverAdapter extends DriverAdapter<MongoDBQuery> {
  provider: 'mongodb'

  /**
   * Executes a raw MongoDB command.
   *
   * @see https://www.prisma.io/docs/orm/prisma-client/using-raw-sql/raw-queries#runcommandraw
   * @see https://www.mongodb.com/docs/manual/reference/command/
   *
   * @param command
   */
  executeRawCommand(command: JSON): Promise<Result<JSON>>
}

export type TransactionOptions = {
  usePhantomQuery: boolean
}

export interface Transaction<Q extends Query = Query> extends Queryable<Q> {
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
