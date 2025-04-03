import type {
  IsolationLevel,
  SqlDriverAdapter,
  SqlMigrationAwareDriverAdapterFactory,
  SqlQuery,
  SqlQueryable,
  SqlResultSet,
  Transaction,
  TransactionOptions,
} from '@prisma/driver-adapter-utils'
import { Debug, DriverAdapterError } from '@prisma/driver-adapter-utils'
import { Mutex } from 'async-mutex'
import type { Database as BetterSQLite3, Options as BetterSQLite3Options } from 'better-sqlite3'
import Database from 'better-sqlite3'

import { name as packageName } from '../package.json'
import { getColumnTypes, mapQueryArgs, mapRow, Row } from './conversion'

const debug = Debug('prisma:driver-adapter:better-sqlite3')

type StdClient = BetterSQLite3

type BetterSQLite3ResultSet = {
  declaredTypes: Array<string | null>
  columnNames: string[]
  values: unknown[][]
}

type BetterSQLite3Meta = {
  /**
   * the total number of rows that were inserted, updated, or deleted by an operation.
   */
  changes: number

  /**
   * The rowid of the last row inserted into the database.
   */
  lastInsertRowid: number | bigint
}

const ERROR_CODE_STRING_TO_CODE_NUM = {
  SQLITE_BUSY: 5,
  SQLITE_CONSTRAINT_FOREIGNKEY: 787,
  SQLITE_CONSTRAINT_NOTNULL: 1299,
  SQLITE_CONSTRAINT_PRIMARYKEY: 1555,
  SQLITE_CONSTRAINT_TRIGGER: 1811,
  SQLITE_CONSTRAINT_UNIQUE: 2067,
}

const LOCK_TAG = Symbol()

class BetterSQLite3Queryable<ClientT extends StdClient> implements SqlQueryable {
  readonly provider = 'sqlite'
  readonly adapterName = packageName

  constructor(protected readonly client: ClientT) {}

  /**
   * Execute a query given as SQL, interpolating the given parameters.
   */
  async queryRaw(query: SqlQuery): Promise<SqlResultSet> {
    const tag = '[js::queryRaw]'
    debug(`${tag} %O`, query)

    const { columnNames, declaredTypes, values } = await this.performIO(query)
    const rows = values as Array<Row>

    const columnTypes = getColumnTypes(declaredTypes, rows)

    return {
      columnNames,
      columnTypes,
      rows: rows.map((row) => mapRow(row, columnTypes)),
    }
  }

  /**
   * Execute a query given as SQL, interpolating the given parameters and
   * returning the number of affected rows.
   * Note: Queryable expects a u64, but napi.rs only supports u32.
   */
  async executeRaw(query: SqlQuery): Promise<number> {
    const tag = '[js::executeRaw]'
    debug(`${tag} %O`, query)

    return (await this.executeIO(query)).changes
  }

  /**
   * Run a query against the database, returning the result set.
   * Should the query fail due to a connection error, the connection is
   * marked as unhealthy.
   */
  private executeIO(query: SqlQuery): Promise<BetterSQLite3Meta> {
    try {
      const stmt = this.client.prepare(query.sql).bind(mapQueryArgs(query.args, query.argTypes))
      const result = stmt.run()

      return Promise.resolve(result)
    } catch (e) {
      this.onError(e)
    }
  }

  /**
   * Run a query against the database, returning the result set.
   * Should the query fail due to a connection error, the connection is
   * marked as unhealthy.
   */
  private performIO(query: SqlQuery): Promise<BetterSQLite3ResultSet> {
    try {
      const stmt = this.client.prepare(query.sql).bind(mapQueryArgs(query.args, query.argTypes))

      // Queries that do not return data (e.g. inserts) cannot call stmt.raw()/stmt.columns(). => Use stmt.run() instead.
      if (!stmt.reader) {
        stmt.run()
        return Promise.resolve({
          columnNames: [],
          declaredTypes: [],
          values: [],
        })
      }

      const columns = stmt.columns()

      const resultSet = {
        declaredTypes: columns.map((column) => column.type),
        columnNames: columns.map((column) => column.name),
        values: stmt.raw().all() as unknown[][],
      }

      return Promise.resolve(resultSet)
    } catch (e) {
      this.onError(e)
    }
  }

  protected onError(error: any): never {
    debug('Error in performIO: %O', error)
    const errCodeNum = error.code && ERROR_CODE_STRING_TO_CODE_NUM[error.code]
    if (errCodeNum) {
      throw new DriverAdapterError({
        kind: 'sqlite',
        extendedCode: errCodeNum,
        message: error.message,
      })
    }
    throw error
  }
}

class BetterSQLite3Transaction extends BetterSQLite3Queryable<StdClient> implements Transaction {
  constructor(client: StdClient, readonly options: TransactionOptions, readonly unlockParent: () => void) {
    super(client)
  }

  commit(): Promise<void> {
    debug(`[js::commit]`)
    this.unlockParent()
    return Promise.resolve()
  }

  rollback(): Promise<void> {
    debug(`[js::rollback]`)
    this.unlockParent()
    return Promise.resolve()
  }
}

export class PrismaBetterSQLite3Adapter extends BetterSQLite3Queryable<StdClient> implements SqlDriverAdapter {
  [LOCK_TAG] = new Mutex()

  constructor(client: StdClient) {
    super(client)
  }

  executeScript(script: string): Promise<void> {
    try {
      this.client.exec(script)
    } catch (e) {
      this.onError(e)
    }
    return Promise.resolve()
  }

  async startTransaction(isolationLevel?: IsolationLevel): Promise<Transaction> {
    if (isolationLevel && isolationLevel !== 'SERIALIZABLE') {
      throw new DriverAdapterError({
        kind: 'InvalidIsolationLevel',
        level: isolationLevel,
      })
    }

    const options: TransactionOptions = {
      usePhantomQuery: false,
    }

    const tag = '[js::startTransaction]'
    debug('%s options: %O', tag, options)

    const release = await this[LOCK_TAG].acquire()

    this.client.prepare('BEGIN').run()

    return new BetterSQLite3Transaction(this.client, options, release)
  }

  dispose(): Promise<void> {
    this.client.close()
    return Promise.resolve()
  }
}

type BetterSQLite3InputParams = BetterSQLite3Options & {
  url: ':memory:' | (string & {})
  shadowDatabaseURL?: ':memory:' | (string & {})
}

export class PrismaBetterSQLite3AdapterFactory implements SqlMigrationAwareDriverAdapterFactory {
  readonly provider = 'sqlite'
  readonly adapterName = packageName

  constructor(private readonly config: BetterSQLite3InputParams) {}

  connect(): Promise<SqlDriverAdapter> {
    return Promise.resolve(new PrismaBetterSQLite3Adapter(createBetterSQLite3Client(this.config)))
  }

  connectToShadowDb(): Promise<SqlDriverAdapter> {
    const url = this.config.shadowDatabaseURL ?? ':memory:'
    return Promise.resolve(new PrismaBetterSQLite3Adapter(createBetterSQLite3Client({ ...this.config, url })))
  }
}

function createBetterSQLite3Client(input: BetterSQLite3InputParams): StdClient {
  const { url, ...config } = input
  const db = new Database(url, config)
  db.defaultSafeIntegers(true)
  return db
}
