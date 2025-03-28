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
import { getColumnTypes, mapRow, Row } from './conversion'
import { createDeferred, Deferred } from './deferred'

const debug = Debug('prisma:driver-adapter:better-sqlite3')

class RollbackError extends Error {
  constructor() {
    super('ROLLBACK')
    this.name = 'RollbackError'

    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, RollbackError)
    }
  }
}

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

const LOCK_TAG = Symbol()

class BetterSQLite3Queryable<ClientT extends StdClient> implements SqlQueryable {
  readonly provider = 'sqlite'
  readonly adapterName = packageName;

  [LOCK_TAG] = new Mutex()

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
  private async executeIO(query: SqlQuery): Promise<BetterSQLite3Meta> {
    const release = await this[LOCK_TAG].acquire()
    try {
      const stmt = this.client.prepare(query.sql).bind(query.args)
      const result = stmt.run()

      return result
    } catch (e) {
      this.onError(e)
    } finally {
      release()
    }
  }

  /**
   * Run a query against the database, returning the result set.
   * Should the query fail due to a connection error, the connection is
   * marked as unhealthy.
   */
  private async performIO(query: SqlQuery): Promise<BetterSQLite3ResultSet> {
    const release = await this[LOCK_TAG].acquire()
    try {
      const stmt = this.client.prepare(query.sql).bind(query.args) // TODO: double-check `Date` serialisation

      const columns = stmt.columns()

      const resultSet = {
        declaredTypes: columns.map((column) => column.type),
        columnNames: columns.map((column) => column.name),
        values: stmt.all() as unknown[][],
      }

      return resultSet
    } catch (e) {
      this.onError(e)
    } finally {
      release()
    }
  }

  protected onError(error: any): never {
    debug('Error in performIO: %O', error)
    const rawCode = error['rawCode'] ?? error.cause?.['rawCode']
    if (typeof rawCode === 'number') {
      throw new DriverAdapterError({
        kind: 'sqlite',
        extendedCode: rawCode,
        message: error.message,
      })
    }
    throw error
  }
}

class BetterSQLite3Transaction extends BetterSQLite3Queryable<StdClient> implements Transaction {
  constructor(
    client: StdClient,
    readonly options: TransactionOptions,
    private txDeferred: Deferred<void>,
    private txResultPromise: Promise<void>,
  ) {
    super(client)
  }

  async commit(): Promise<void> {
    debug(`[js::commit]`)

    this.txDeferred.resolve()
    return await this.txResultPromise
  }

  async rollback(): Promise<void> {
    debug(`[js::rollback]`)

    this.txDeferred.reject(new RollbackError())
    return await this.txResultPromise
  }
}

export class PrismaBetterSQLite3Adapter extends BetterSQLite3Queryable<StdClient> implements SqlDriverAdapter {
  constructor(client: StdClient) {
    super(client)
  }

  async executeScript(script: string): Promise<void> {
    const release = await this[LOCK_TAG].acquire()
    try {
      this.client.exec(script)
    } catch (e) {
      this.onError(e)
    } finally {
      release()
    }
  }

  async startTransaction(isolationLevel?: IsolationLevel): Promise<Transaction> {
    if (isolationLevel && isolationLevel !== 'SERIALIZABLE') {
      throw new DriverAdapterError({
        kind: 'InvalidIsolationLevel',
        level: isolationLevel,
      })
    }

    const options: TransactionOptions = {
      usePhantomQuery: true,
    }

    const tag = '[js::startTransaction]'
    debug('%s options: %O', tag, options)

    const release = await this[LOCK_TAG].acquire()

    try {
      // Create the deferred promise and transaction result promise first
      const [txDeferred, deferredPromise] = createDeferred<void>()

      // Create a promise that will resolve with the transaction
      const transactionPromise = new Promise<Transaction>((resolve, reject) => {
        try {
          // Start the transaction with BetterSQLite3
          this.client
            .transaction(() => {
              // Create transaction wrapper now that txResultPromise exists
              const txWrapper = new BetterSQLite3Transaction(this.client, options, txDeferred, deferredPromise)

              // Resolve the outer promise with the transaction wrapper
              resolve(txWrapper)

              // Return the promise that will be resolved/rejected by commit/rollback
              return deferredPromise
            })
            .deferred()
            .catch((error) => {
              // Special case for rollback - don't treat it as an error
              if (error instanceof RollbackError) {
                return
              }
              reject(error)
            })
        } catch (error) {
          reject(error)
        }
      })

      // When any error occurs during transaction creation, release the lock
      transactionPromise.catch(() => {
        release()
      })

      return await transactionPromise
    } catch (error) {
      release()
      throw error
    }
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
  return new Database(url, config)
}
