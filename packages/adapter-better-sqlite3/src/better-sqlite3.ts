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
import type { Database as BetterSqlite3, Options as BetterSqlite3Options } from 'better-sqlite3'
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

type StdClient = BetterSqlite3

type BetterSqlite3ResultSet = {
  declaredTypes: Array<string | null>
  columnNames: string[]
  values: unknown[][]
}

type BetterSqlite3Meta = {
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

class BetterSqlite3Queryable<ClientT extends StdClient> implements SqlQueryable {
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
  private async executeIO(query: SqlQuery): Promise<BetterSqlite3Meta> {
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
  private async performIO(query: SqlQuery): Promise<BetterSqlite3ResultSet> {
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

class BetterSqlite3Transaction extends BetterSqlite3Queryable<StdClient> implements Transaction {
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

export class PrismaBetterSqlite3Adapter extends BetterSqlite3Queryable<StdClient> implements SqlDriverAdapter {
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

    return new Promise<Transaction>((resolve, reject) => {
      const txResultPromise = this.client
        .transaction(async () => {
          const [txDeferred, deferredPromise] = createDeferred<void>()
          const txWrapper = new BetterSqlite3Transaction(this.client, options, txDeferred, txResultPromise)

          resolve(txWrapper)
          return deferredPromise
        })
        .deferred()
        .catch((error) => {
          // Rollback error is ignored, any other error is legit and is re-thrown.
          if (!(error instanceof RollbackError)) {
            return reject(error)
          }

          // note: we only release the lock if creating the transaction fails, it must stay locked otherwise,
          // hence `catch` and rethrowing the error and not `finally`.
          release()
          throw error
        })
    })
  }

  dispose(): Promise<void> {
    this.client.close()
    return Promise.resolve()
  }
}

type BetterSqlite3InputParams = BetterSqlite3Options & {
  url: ':memory:' | (string & {})
  shadowDatabaseURL?: ':memory:' | (string & {})
}

export class PrismaBetterSqlite3AdapterFactory implements SqlMigrationAwareDriverAdapterFactory {
  readonly provider = 'sqlite'
  readonly adapterName = packageName

  constructor(private readonly config: BetterSqlite3InputParams) {}

  connect(): Promise<SqlDriverAdapter> {
    return Promise.resolve(new PrismaBetterSqlite3Adapter(createBetterSqlite3Client(this.config)))
  }

  connectToShadowDb(): Promise<SqlDriverAdapter> {
    const url = this.config.shadowDatabaseURL ?? ':memory:'
    return Promise.resolve(new PrismaBetterSqlite3Adapter(createBetterSqlite3Client({ ...this.config, url })))
  }
}

function createBetterSqlite3Client(input: BetterSqlite3InputParams): StdClient {
  const { url, ...config } = input
  return new Database(url, config)
}
