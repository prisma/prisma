import type planetScale from '@planetscale/database'
import { Debug, err, ok } from '@prisma/driver-adapter-utils'
import type {
  DriverAdapter,
  ResultSet,
  Query,
  Queryable,
  Transaction,
  Result,
  TransactionOptions,
} from '@prisma/driver-adapter-utils'
import { type PlanetScaleColumnType, fieldToColumnType } from './conversion'
import { createDeferred, Deferred } from './deferred'

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

class PlanetScaleQueryable<ClientT extends planetScale.Connection | planetScale.Transaction> implements Queryable {
  readonly flavour = 'mysql'
  constructor(protected client: ClientT) {}

  /**
   * Execute a query given as SQL, interpolating the given parameters.
   */
  async queryRaw(query: Query): Promise<Result<ResultSet>> {
    const tag = '[js::query_raw]'
    debug(`${tag} %O`, query)

    const ioResult = await this.performIO(query)
    return ioResult.map(({ fields, insertId: lastInsertId, rows }) => {
      const columns = fields.map((field) => field.name)
      return {
        columnNames: columns,
        columnTypes: fields.map((field) => fieldToColumnType(field.type as PlanetScaleColumnType)),
        rows: rows as ResultSet['rows'],
        lastInsertId,
      }
    })
  }

  /**
   * Execute a query given as SQL, interpolating the given parameters and
   * returning the number of affected rows.
   * Note: Queryable expects a u64, but napi.rs only supports u32.
   */
  async executeRaw(query: Query): Promise<Result<number>> {
    const tag = '[js::execute_raw]'
    debug(`${tag} %O`, query)

    return (await this.performIO(query)).map(({ rowsAffected }) => rowsAffected)
  }

  /**
   * Run a query against the database, returning the result set.
   * Should the query fail due to a connection error, the connection is
   * marked as unhealthy.
   */
  private async performIO(query: Query): Promise<Result<planetScale.ExecutedQuery>> {
    const { sql, args: values } = query

    try {
      const result = await this.client.execute(sql, values, {
        as: 'array',
      })
      return ok(result)
    } catch (e) {
      const error = e as Error
      if (error.name === 'DatabaseError') {
        const parsed = parseErrorMessage(error.message)
        if (parsed) {
          return err({
            kind: 'Mysql',
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
  const match = message.match(
    /target: (?:.+?) vttablet: (?<message>.+?) \(errno (?<code>\d+)\) \(sqlstate (?<state>.+?)\)/,
  )

  if (!match || !match.groups) {
    return undefined
  }
  return {
    code: Number(match.groups.code),
    message: match.groups.message,
    state: match.groups.state,
  }
}

class PlanetScaleTransaction extends PlanetScaleQueryable<planetScale.Transaction> implements Transaction {
  finished = false

  constructor(
    tx: planetScale.Transaction,
    readonly options: TransactionOptions,
    private txDeferred: Deferred<void>,
    private txResultPromise: Promise<void>,
  ) {
    super(tx)
  }

  async commit(): Promise<Result<void>> {
    debug(`[js::commit]`)

    this.finished = true
    this.txDeferred.resolve()
    return Promise.resolve(ok(await this.txResultPromise))
  }

  async rollback(): Promise<Result<void>> {
    debug(`[js::rollback]`)

    this.finished = true
    this.txDeferred.reject(new RollbackError())
    return Promise.resolve(ok(await this.txResultPromise))
  }

  dispose(): Result<void> {
    if (!this.finished) {
      this.rollback().catch(console.error)
    }
    return ok(undefined)
  }
}

export class PrismaPlanetScale extends PlanetScaleQueryable<planetScale.Connection> implements DriverAdapter {
  constructor(client: planetScale.Connection) {
    super(client)
  }

  async startTransaction() {
    const options: TransactionOptions = {
      usePhantomQuery: true,
    }

    const tag = '[js::startTransaction]'
    debug(`${tag} options: %O`, options)

    return new Promise<Result<Transaction>>((resolve, reject) => {
      const txResultPromise = this.client
        .transaction(async (tx) => {
          const [txDeferred, deferredPromise] = createDeferred<void>()
          const txWrapper = new PlanetScaleTransaction(tx, options, txDeferred, txResultPromise)

          resolve(ok(txWrapper))
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

  async close() {
    return ok(undefined)
  }
}
