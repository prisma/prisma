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
import { getColumnTypes, mapArg, mapRow, Row } from './conversion'
import { convertDriverError } from './errors'

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

class BetterSQLite3Queryable<ClientT extends StdClient> implements SqlQueryable {
  readonly provider = 'sqlite'
  readonly adapterName = packageName

  constructor(
    protected readonly client: ClientT,
    protected readonly adapterOptions?: PrismaBetterSQLite3Options,
  ) {}

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
      const args = query.args.map((arg, i) => mapArg(arg, query.argTypes[i], this.adapterOptions))
      const stmt = this.client.prepare(query.sql).bind(args)
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
      const args = query.args.map((arg, i) => mapArg(arg, query.argTypes[i], this.adapterOptions))
      const stmt = this.client.prepare(query.sql).bind(args)

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
    throw new DriverAdapterError(convertDriverError(error))
  }
}

class BetterSQLite3Transaction extends BetterSQLite3Queryable<StdClient> implements Transaction {
  readonly #unlockParent: () => void

  constructor(
    client: StdClient,
    readonly options: TransactionOptions,
    adapterOptions: PrismaBetterSQLite3Options | undefined,
    unlockParent: () => void,
  ) {
    super(client, adapterOptions)
    this.#unlockParent = unlockParent
  }

  commit(): Promise<void> {
    debug(`[js::commit]`)
    this.#unlockParent()
    return Promise.resolve()
  }

  rollback(): Promise<void> {
    debug(`[js::rollback]`)
    this.#unlockParent()
    return Promise.resolve()
  }
}

export class PrismaBetterSQLite3Adapter extends BetterSQLite3Queryable<StdClient> implements SqlDriverAdapter {
  #mutex = new Mutex()

  constructor(client: StdClient, adapterOptions?: PrismaBetterSQLite3Options) {
    super(client, adapterOptions)
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

    try {
      const release = await this.#mutex.acquire()

      this.client.prepare('BEGIN').run()

      return new BetterSQLite3Transaction(this.client, options, this.adapterOptions, release)
    } catch (e) {
      this.onError(e)
    }
  }

  dispose(): Promise<void> {
    this.client.close()
    return Promise.resolve()
  }
}

type BetterSQLite3InputParams = BetterSQLite3Options & {
  url: ':memory:' | (string & {})
}

export type PrismaBetterSQLite3Options = {
  shadowDatabaseUrl?: string
  timestampFormat?: 'iso8601' | 'unixepoch-ms'
}

export class PrismaBetterSQLite3AdapterFactory implements SqlMigrationAwareDriverAdapterFactory {
  readonly provider = 'sqlite'
  readonly adapterName = packageName

  readonly #config: BetterSQLite3InputParams
  readonly #options?: PrismaBetterSQLite3Options

  constructor(config: BetterSQLite3InputParams, options?: PrismaBetterSQLite3Options) {
    this.#config = config
    this.#options = options
  }

  connect(): Promise<SqlDriverAdapter> {
    return Promise.resolve(new PrismaBetterSQLite3Adapter(createBetterSQLite3Client(this.#config), this.#options))
  }

  connectToShadowDb(): Promise<SqlDriverAdapter> {
    const url = this.#options?.shadowDatabaseUrl ?? ':memory:'
    return Promise.resolve(
      new PrismaBetterSQLite3Adapter(createBetterSQLite3Client({ ...this.#config, url }), this.#options),
    )
  }
}

function createBetterSQLite3Client(input: BetterSQLite3InputParams): StdClient {
  const { url, ...config } = input
  const dbPath = url.replace(/^file:/, '')
  const db = new Database(dbPath, config)
  db.defaultSafeIntegers(true)
  return db
}
