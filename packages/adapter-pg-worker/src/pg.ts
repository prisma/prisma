/* eslint-disable @typescript-eslint/require-await */
import type {
  ColumnType,
  ConnectionInfo,
  DriverAdapter,
  Query,
  Queryable,
  Result,
  ResultSet,
  Transaction,
  TransactionOptions,
} from '@prisma/driver-adapter-utils'
import { Debug, err, ok } from '@prisma/driver-adapter-utils'
import * as pg from '@prisma/pg-worker'

import { name as packageName } from '../package.json'
import { fieldToColumnType, fixArrayBufferValues, UnsupportedNativeDataType } from './conversion'

const debug = Debug('prisma:driver-adapter:pg')

type StdClient = pg.Pool
type TransactionClient = pg.PoolClient

// eslint-disable-next-line @typescript-eslint/no-redundant-type-constituents
class PgQueryable<ClientT extends StdClient | TransactionClient> implements Queryable {
  readonly provider = 'postgres'
  readonly adapterName = packageName

  constructor(protected readonly client: ClientT) {}

  /**
   * Execute a query given as SQL, interpolating the given parameters.
   */
  async queryRaw(query: Query): Promise<Result<ResultSet>> {
    const tag = '[js::query_raw]'
    debug(`${tag} %O`, query)

    const res = await this.performIO(query)

    if (!res.ok) {
      return err(res.error)
    }

    const { fields, rows } = res.value
    const columnNames = fields.map((field) => field.name)
    let columnTypes: ColumnType[] = []

    try {
      columnTypes = fields.map((field) => fieldToColumnType(field.dataTypeID))
    } catch (e) {
      if (e instanceof UnsupportedNativeDataType) {
        return err({
          kind: 'UnsupportedNativeDataType',
          type: e.type,
        })
      }
      throw e
    }

    return ok({
      columnNames,
      columnTypes,
      rows,
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
      const result = await this.client.query({ text: sql, values: fixArrayBufferValues(values), rowMode: 'array' })
      return ok(result)
    } catch (e) {
      const error = e as Error
      debug('Error in performIO: %O', error)
      if (e && typeof e.code === 'string' && typeof e.severity === 'string' && typeof e.message === 'string') {
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
  constructor(client: pg.PoolClient, readonly options: TransactionOptions) {
    super(client)
  }

  async commit(): Promise<Result<void>> {
    debug(`[js::commit]`)

    this.client.release()
    return ok(undefined)
  }

  async rollback(): Promise<Result<void>> {
    debug(`[js::rollback]`)

    this.client.release()
    return ok(undefined)
  }
}

export type PrismaPgOptions = {
  schema?: string
}

export class PrismaPg extends PgQueryable<StdClient> implements DriverAdapter {
  constructor(client: pg.Pool, private options?: PrismaPgOptions) {
    if (!(client instanceof pg.Pool)) {
      throw new TypeError(`PrismaPg must be initialized with an instance of Pool:
import { Pool } from 'pg'
const pool = new Pool({ connectionString: url })
const adapter = new PrismaPg(pool)
`)
    }
    super(client)
  }

  getConnectionInfo(): Result<ConnectionInfo> {
    return ok({
      schemaName: this.options?.schema,
    })
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
}
