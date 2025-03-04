/* eslint-disable @typescript-eslint/require-await */

// default import does not work correctly for JS values inside,
// i.e. client
import * as planetScale from '@planetscale/database'
import type {
  ConnectionInfo,
  SqlConnection,
  SqlQuery,
  SqlQueryable,
  SqlResultSet,
  Transaction,
  TransactionContext,
  TransactionOptions,
} from '@prisma/driver-adapter-utils'
import { Debug, DriverAdapterError } from '@prisma/driver-adapter-utils'

import { name as packageName } from '../package.json'
import { cast, fieldToColumnType, type PlanetScaleColumnType } from './conversion'
import { createDeferred, type Deferred } from './deferred'

const debug = Debug('prisma:driver-adapter:planetscale')

class RollbackError extends Error {
  constructor() {
    super('ROLLBACK')
    this.name = 'RollbackError'

    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, RollbackError)
    }
  }
}

class PlanetScaleQueryable<ClientT extends planetScale.Client | planetScale.Transaction | planetScale.Connection>
  implements SqlQueryable
{
  readonly provider = 'mysql'
  readonly adapterName = packageName

  constructor(protected client: ClientT) {}

  /**
   * Execute a query given as SQL, interpolating the given parameters.
   */
  async queryRaw(query: SqlQuery): Promise<SqlResultSet> {
    const tag = '[js::query_raw]'
    debug(`${tag} %O`, query)

    const { fields, insertId: lastInsertId, rows } = await this.performIO(query)
    const columns = fields.map((field) => field.name)
    return {
      columnNames: columns,
      columnTypes: fields.map((field) => fieldToColumnType(field.type as PlanetScaleColumnType)),
      rows: rows as SqlResultSet['rows'],
      lastInsertId,
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

    return (await this.performIO(query)).rowsAffected
  }

  /**
   * Run a query against the database, returning the result set.
   * Should the query fail due to a connection error, the connection is
   * marked as unhealthy.
   */
  private async performIO(query: SqlQuery): Promise<planetScale.ExecutedQuery> {
    const { sql, args: values } = query

    try {
      const result = await this.client.execute(sql, values, {
        as: 'array',
        cast,
      })
      return result
    } catch (e) {
      const error = e as Error
      if (error.name === 'DatabaseError') {
        const parsed = parseErrorMessage(error.message)
        if (parsed) {
          throw new DriverAdapterError({
            kind: 'mysql',
            ...parsed,
          })
        }
      }
      debug('Error in performIO: %O', error)
      throw error
    }
  }
}

function parseErrorMessage(message: string) {
  const regex = /^(.*) \(errno (\d+)\) \(sqlstate ([A-Z0-9]+)\)/
  const match = message.match(regex)

  if (match) {
    const [, message, codeAsString, sqlstate] = match
    const code = Number.parseInt(codeAsString, 10)

    return {
      message,
      code,
      state: sqlstate,
    }
  }
    return undefined
}

class PlanetScaleTransaction extends PlanetScaleQueryable<planetScale.Transaction> implements Transaction {
  constructor(
    tx: planetScale.Transaction,
    readonly options: TransactionOptions,
    private txDeferred: Deferred<void>,
    private txResultPromise: Promise<void>,
  ) {
    super(tx)
  }

  async commit(): Promise<void> {
    debug('[js::commit]')

    this.txDeferred.resolve()
    return await this.txResultPromise
  }

  async rollback(): Promise<void> {
    debug('[js::rollback]')

    this.txDeferred.reject(new RollbackError())
    return await this.txResultPromise
  }
}

class PlanetScaleTransactionContext extends PlanetScaleQueryable<planetScale.Connection> implements TransactionContext {
  constructor(private conn: planetScale.Connection) {
    super(conn)
  }

  async startTransaction(): Promise<Transaction> {
    const options: TransactionOptions = {
      usePhantomQuery: true,
    }

    const tag = '[js::startTransaction]'
    debug('%s options: %O', tag, options)

    return new Promise<Transaction>((resolve, reject) => {
      const txResultPromise = this.conn
        .transaction((tx) => {
          const [txDeferred, deferredPromise] = createDeferred<void>()
          const txWrapper = new PlanetScaleTransaction(tx, options, txDeferred, txResultPromise)

          resolve(txWrapper)
          return deferredPromise
        })
        .catch((error) => {
          // Rollback error is ignored (so that tx.rollback() won't crash)
          // any other error is legit and is re-thrown
          if (!(error instanceof RollbackError)) {
            return reject(error)
          }

          return undefined
        })
    })
  }
}

export class PrismaPlanetScale extends PlanetScaleQueryable<planetScale.Client> implements SqlConnection {
  constructor(client: planetScale.Client) {
    // this used to be a check for constructor name at same point (more reliable when having multiple copies
    // of @planetscale/database), but that did not work with minifiers, so we reverted back to `instanceof`
    if (!(client instanceof planetScale.Client)) {
      throw new TypeError(`PrismaPlanetScale must be initialized with an instance of Client:
import { Client } from '@planetscale/database'
const client = new Client({ url })
const adapter = new PrismaPlanetScale(client)
`)
    }
    super(client)
  }

  executeScript(_script: string): Promise<void> {
    throw new Error('Not implemented yet')
  }

  getConnectionInfo(): ConnectionInfo {
    const url = this.client.connection().url as string
    const dbName = new URL(url).pathname.slice(1) /* slice out forward slash */
    return {
      schemaName: dbName,
    }
  }

  transactionContext(): Promise<TransactionContext> {
    const conn = this.client.connection()
    const ctx = new PlanetScaleTransactionContext(conn)
    return Promise.resolve(ctx)
  }

  async dispose(): Promise<void> {}
}
