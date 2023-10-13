import type pg from 'pg'
import { Debug, err, ok } from '@prisma/driver-adapter-utils'
import type {
  DriverAdapter,
  Query,
  Queryable,
  Result,
  ResultSet,
  Transaction,
  TransactionOptions,
} from '@prisma/driver-adapter-utils'
import { fieldToColumnType } from './conversion'

const debug = Debug('prisma:driver-adapter:pg')

type StdClient = pg.Pool
type TransactionClient = pg.PoolClient

class PgQueryable<ClientT extends StdClient | TransactionClient> implements Queryable {
  readonly flavour = 'postgres'

  constructor(protected readonly client: ClientT) {}

  /**
   * Execute a query given as SQL, interpolating the given parameters.
   */
  async queryRaw(query: Query): Promise<Result<ResultSet>> {
    const tag = '[js::query_raw]'
    debug(`${tag} %O`, query)

    const ioResult = await this.performIO(query)
    return ioResult.map(({ fields, rows }) => {
      const columns = fields.map((field) => field.name)
      const columnTypes = fields.map((field) => fieldToColumnType(field.dataTypeID))

      return {
        columnNames: columns,
        columnTypes,
        rows,
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

    // Note: `rowsAffected` can sometimes be null (e.g., when executing `"BEGIN"`)
    return (await this.performIO(query)).map(({ rowCount: rowsAffected }) => rowsAffected ?? 0)
  }

  /**
   * Run a query against the database, returning the result set.
   * Should the query fail due to a connection error, the connection is
   * marked as unhealthy.
   */
  private async performIO(query: Query): Promise<Result<pg.QueryArrayResult<any>>> {
    const { sql, args: values } = query

    try {
      const result = await this.client.query({ text: sql, values, rowMode: 'array' })
      return ok(result)
    } catch (e) {
      const error = e as Error
      debug('Error in performIO: %O', error)
      if (e && e.code) {
        return err({
          kind: 'Postgres',
          code: e.code,
          severity: e.severity,
          message: e.message,
          detail: e.detail,
          column: e.column,
          hint: e.hint,
        })
      }
      throw error
    }
  }
}

class PgTransaction extends PgQueryable<TransactionClient> implements Transaction {
  finished = false

  constructor(client: pg.PoolClient, readonly options: TransactionOptions) {
    super(client)
  }

  async commit(): Promise<Result<void>> {
    debug(`[js::commit]`)

    this.finished = true
    this.client.release()
    return ok(undefined)
  }

  async rollback(): Promise<Result<void>> {
    debug(`[js::rollback]`)

    this.finished = true
    this.client.release()
    return ok(undefined)
  }

  dispose(): Result<void> {
    if (!this.finished) {
      this.client.release()
    }
    return ok(undefined)
  }
}

export class PrismaPg extends PgQueryable<StdClient> implements DriverAdapter {
  constructor(client: pg.Pool) {
    super(client)
  }

  async startTransaction(): Promise<Result<Transaction>> {
    const options: TransactionOptions = {
      usePhantomQuery: false,
    }

    const tag = '[js::startTransaction]'
    debug(`${tag} options: %O`, options)

    const connection = await this.client.connect()
    return ok(new PgTransaction(connection, options))
  }

  async close() {
    return ok(undefined)
  }
}
