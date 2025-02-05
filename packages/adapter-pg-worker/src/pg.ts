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
  TransactionContext,
  TransactionOptions,
} from '@prisma/driver-adapter-utils'
import { Debug, err, ok } from '@prisma/driver-adapter-utils'
import * as pg from '@prisma/pg-worker'

import { name as packageName } from '../package.json'
import { customParsers, fieldToColumnType, fixArrayBufferValues, UnsupportedNativeDataType } from './conversion'

const types = pg.types
const debug = Debug('prisma:driver-adapter:pg')

type StdClient = pg.Pool
type TransactionClient = pg.PoolClient

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
      const result = await this.client.query(
        {
          text: sql,
          values: fixArrayBufferValues(values),
          rowMode: 'array',
          types: {
            // This is the error expected:
            // No overload matches this call.
            // The last overload gave the following error.
            // Type '(oid: number, format?: any) => (json: string) => unknown' is not assignable to type '{ <T>(oid: number): TypeParser<string, string | T>; <T>(oid: number, format: "text"): TypeParser<string, string | T>; <T>(oid: number, format: "binary"): TypeParser<...>; }'.
            //   Type '(json: string) => unknown' is not assignable to type 'TypeParser<Buffer, any>'.
            //     Types of parameters 'json' and 'value' are incompatible.
            //       Type 'Buffer' is not assignable to type 'string'.ts(2769)
            //
            // Because pg-types types expect us to handle both binary and text protocol versions,
            // where as far we can see, pg will ever pass only text version.
            //
            // @ts-expect-error
            getTypeParser: (oid: number, format?) => {
              if (format === 'text' && customParsers[oid]) {
                return customParsers[oid]
              }

              return types.getTypeParser(oid, format)
            },
          },
        },
        fixArrayBufferValues(values),
      )

      return ok(result)
    } catch (e) {
      const error = e as Error
      debug('Error in performIO: %O', error)
      if (e && typeof e.code === 'string' && typeof e.severity === 'string' && typeof e.message === 'string') {
        return err({
          kind: 'postgres',
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

class PgTransactionContext extends PgQueryable<pg.PoolClient> implements TransactionContext {
  constructor(readonly conn: pg.PoolClient) {
    super(conn)
  }

  async startTransaction(): Promise<Result<Transaction>> {
    const options: TransactionOptions = {
      usePhantomQuery: false,
    }

    const tag = '[js::startTransaction]'
    debug('%s options: %O', tag, options)

    return ok(new PgTransaction(this.conn, options))
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

  async transactionContext(): Promise<Result<TransactionContext>> {
    const conn = await this.client.connect()
    return ok(new PgTransactionContext(conn))
  }
}
