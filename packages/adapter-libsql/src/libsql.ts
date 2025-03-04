import {
  type Client as LibSqlClientRaw,
  type Config as LibSqlConfig,
  createClient,
  type InStatement,
  type ResultSet as LibSqlResultSet,
  type Transaction as LibSqlTransactionRaw,
} from '@libsql/client'
import type {
  SqlConnection,
  SqlMigrationAwareDriverAdapter,
  SqlQuery,
  SqlQueryable,
  SqlResultSet,
  Transaction,
  TransactionContext,
  TransactionOptions,
} from '@prisma/driver-adapter-utils'
import { Debug, DriverAdapterError } from '@prisma/driver-adapter-utils'
import { Mutex } from 'async-mutex'

import { name as packageName } from '../package.json'
import { getColumnTypes, mapRow } from './conversion'

const debug = Debug('prisma:driver-adapter:libsql')

type StdClient = LibSqlClientRaw
type TransactionClient = LibSqlTransactionRaw

const LOCK_TAG = Symbol()

class LibSqlQueryable<ClientT extends StdClient | TransactionClient> implements SqlQueryable {
  readonly provider = 'sqlite'
  readonly adapterName = packageName;

  [LOCK_TAG] = new Mutex()

  constructor(protected readonly client: ClientT) {}

  /**
   * Execute a query given as SQL, interpolating the given parameters.
   */
  async queryRaw(query: SqlQuery): Promise<SqlResultSet> {
    const tag = '[js::query_raw]'
    debug(`${tag} %O`, query)

    const { columns, rows, columnTypes: declaredColumnTypes } = await this.performIO(query)

    const columnTypes = getColumnTypes(declaredColumnTypes, rows)

    return {
      columnNames: columns,
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
    const tag = '[js::execute_raw]'
    debug(`${tag} %O`, query)

    return (await this.performIO(query)).rowsAffected ?? 0
  }

  /**
   * Run a query against the database, returning the result set.
   * Should the query fail due to a connection error, the connection is
   * marked as unhealthy.
   */
  private async performIO(query: SqlQuery): Promise<LibSqlResultSet> {
    const release = await this[LOCK_TAG].acquire()
    try {
      const result = await this.client.execute(query as InStatement)
      return result
    } catch (e) {
      this.onError(e)
    } finally {
      release()
    }
  }

  protected onError(error: unknown): never {
    debug('Error in performIO: %O', error)
    const rawCode = error.rawCode ?? error.cause?.rawCode
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

class LibSqlTransaction extends LibSqlQueryable<TransactionClient> implements Transaction {
  constructor(client: TransactionClient, readonly options: TransactionOptions, readonly unlockParent: () => void) {
    super(client)
  }

  async commit(): Promise<void> {
    debug('[js::commit]')

    try {
      await this.client.commit()
    } finally {
      this.unlockParent()
    }
  }

  async rollback(): Promise<void> {
    debug('[js::rollback]')

    try {
      await this.client.rollback()
    } catch (error) {
      debug('error in rollback:', error)
    } finally {
      this.unlockParent()
    }
  }
}

class LibSqlTransactionContext extends LibSqlQueryable<StdClient> implements TransactionContext {
  constructor(readonly client: StdClient, readonly release: () => void) {
    super(client)
  }

  async startTransaction(): Promise<Transaction> {
    const options: TransactionOptions = {
      usePhantomQuery: true,
    }

    const tag = '[js::startTransaction]'
    debug('%s options: %O', tag, options)

    try {
      const tx = await this.client.transaction('deferred')
      return new LibSqlTransaction(tx, options, this.release)
    } catch (e) {
      // note: we only release the lock if creating the transaction fails, it must stay locked otherwise,
      // hence `catch` and rethrowing the error and not `finally`.
      this.release()
      throw e
    }
  }
}

export class PrismaLibSQL extends LibSqlQueryable<StdClient> implements SqlConnection {

  async executeScript(script: string): Promise<void> {
    const release = await this[LOCK_TAG].acquire()
    try {
      await this.client.executeMultiple(script)
    } catch (e) {
      this.onError(e)
    } finally {
      release()
    }
  }

  async transactionContext(): Promise<TransactionContext> {
    const release = await this[LOCK_TAG].acquire()
    return new LibSqlTransactionContext(this.client, release)
  }

  dispose(): Promise<void> {
    this.client.close()
    return Promise.resolve()
  }
}

export class PrismaLibSQLWithMigration implements SqlMigrationAwareDriverAdapter {
  readonly provider = 'sqlite'
  readonly adapterName = packageName

  constructor(private readonly config: LibSqlConfig) {}

  connect(): Promise<SqlConnection> {
    return Promise.resolve(new PrismaLibSQL(createClient(this.config)))
  }

  connectToShadowDb(): Promise<SqlConnection> {
    // TODO: the user should be able to provide a custom URL for the shadow database
    return Promise.resolve(new PrismaLibSQL(createClient({ ...this.config, url: ':memory:' })))
  }
}
