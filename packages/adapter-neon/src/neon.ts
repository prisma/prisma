/* eslint-disable @typescript-eslint/require-await */
import * as neon from '@neondatabase/serverless'
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

import { name as packageName } from '../package.json'
import { fieldToColumnType, fixArrayBufferValues, UnsupportedNativeDataType } from './conversion'

const debug = Debug('prisma:driver-adapter:neon')

type ARRAY_MODE_ENABLED = true

type PerformIOResult = neon.QueryResult<any> | neon.FullQueryResults<ARRAY_MODE_ENABLED>

/**
 * Base class for http client, ws client and ws transaction
 */
abstract class NeonQueryable implements Queryable {
  readonly provider = 'postgres'
  readonly adapterName = packageName

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

  async executeRaw(query: Query): Promise<Result<number>> {
    const tag = '[js::execute_raw]'
    debug(`${tag} %O`, query)

    // Note: `rowsAffected` can sometimes be null (e.g., when executing `"BEGIN"`)
    return (await this.performIO(query)).map((r) => r.rowCount ?? 0)
  }

  abstract performIO(query: Query): Promise<Result<PerformIOResult>>
}

/**
 * Base class for WS-based queryables: top-level client and transaction
 */
class NeonWsQueryable<ClientT extends neon.Pool | neon.PoolClient> extends NeonQueryable {
  constructor(protected client: ClientT) {
    super()
  }

  override async performIO(query: Query): Promise<Result<PerformIOResult>> {
    const { sql, args: values } = query

    try {
      return ok(await this.client.query({ text: sql, values: fixArrayBufferValues(values), rowMode: 'array' }))
    } catch (e) {
      debug('Error in performIO: %O', e)
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
      throw e
    }
  }
}

class NeonTransaction extends NeonWsQueryable<neon.PoolClient> implements Transaction {
  constructor(client: neon.PoolClient, readonly options: TransactionOptions) {
    super(client)
  }

  async commit(): Promise<Result<void>> {
    debug(`[js::commit]`)

    this.client.release()
    return Promise.resolve(ok(undefined))
  }

  async rollback(): Promise<Result<void>> {
    debug(`[js::rollback]`)

    this.client.release()
    return Promise.resolve(ok(undefined))
  }
}

export type PrismaNeonOptions = {
  schema?: string
}

export class PrismaNeon extends NeonWsQueryable<neon.Pool> implements DriverAdapter {
  private isRunning = true

  constructor(pool: neon.Pool, private options?: PrismaNeonOptions) {
    if (!(pool instanceof neon.Pool)) {
      throw new TypeError(`PrismaNeon must be initialized with an instance of Pool:
import { Pool } from '@neondatabase/serverless'
const pool = new Pool({ connectionString: url })
const adapter = new PrismaNeon(pool)
`)
    }
    super(pool)
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
    return ok(new NeonTransaction(connection, options))
  }

  async close() {
    if (this.isRunning) {
      await this.client.end()
      this.isRunning = false
    }
    return ok(undefined)
  }
}

export class PrismaNeonHTTP extends NeonQueryable implements DriverAdapter {
  constructor(private client: neon.NeonQueryFunction<any, any>) {
    super()
  }

  override async performIO(query: Query): Promise<Result<PerformIOResult>> {
    const { sql, args: values } = query
    return ok(
      await this.client(sql, values, {
        arrayMode: true,
        fullResults: true,
      }),
    )
  }

  startTransaction(): Promise<Result<Transaction>> {
    return Promise.reject(new Error('Transactions are not supported in HTTP mode'))
  }
}
