/* eslint-disable @typescript-eslint/require-await */

import * as neon from '@neondatabase/serverless'
import type {
  ColumnType,
  ConnectionInfo,
  IsolationLevel,
  SqlDriverAdapter,
  SqlDriverAdapterFactory,
  SqlQuery,
  SqlQueryable,
  SqlResultSet,
  Transaction,
  TransactionOptions,
} from '@prisma/driver-adapter-utils'
import { Debug, DriverAdapterError } from '@prisma/driver-adapter-utils'

import { name as packageName } from '../package.json'
import { customParsers, fieldToColumnType, fixArrayBufferValues, UnsupportedNativeDataType } from './conversion'
import { convertDriverError } from './errors'

const debug = Debug('prisma:driver-adapter:neon')

type ARRAY_MODE_ENABLED = true

type PerformIOResult = neon.QueryResult<any> | neon.FullQueryResults<ARRAY_MODE_ENABLED>

/**
 * Base class for http client, ws client and ws transaction
 */
abstract class NeonQueryable implements SqlQueryable {
  readonly provider = 'postgres'
  readonly adapterName = packageName

  /**
   * Execute a query given as SQL, interpolating the given parameters.
   */
  async queryRaw(query: SqlQuery): Promise<SqlResultSet> {
    const tag = '[js::query_raw]'
    debug(`${tag} %O`, query)

    const { fields, rows } = await this.performIO(query)
    const columnNames = fields.map((field) => field.name)
    let columnTypes: ColumnType[] = []

    try {
      columnTypes = fields.map((field) => fieldToColumnType(field.dataTypeID))
    } catch (e) {
      if (e instanceof UnsupportedNativeDataType) {
        throw new DriverAdapterError({
          kind: 'UnsupportedNativeDataType',
          type: e.type,
        })
      }
      throw e
    }

    return {
      columnNames,
      columnTypes,
      rows,
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

    // Note: `rowsAffected` can sometimes be null (e.g., when executing `"BEGIN"`)
    return (await this.performIO(query)).rowCount ?? 0
  }

  /**
   * Run a query against the database, returning the result set.
   * Should the query fail due to a connection error, the connection is
   * marked as unhealthy.
   */
  abstract performIO(query: SqlQuery): Promise<PerformIOResult>
}

/**
 * Base class for WS-based queryables: top-level client and transaction
 */
class NeonWsQueryable<ClientT extends neon.Pool | neon.PoolClient> extends NeonQueryable {
  constructor(protected client: ClientT) {
    super()
  }

  override async performIO(query: SqlQuery): Promise<PerformIOResult> {
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
            //   Type '(oid: number, format?: any) => (json: string) => unknown' is not assignable to type '{ <T>(oid: number): TypeParser<string, string | T>; <T>(oid: number, format: "text"): TypeParser<string, string | T>; <T>(oid: number, format: "binary"): TypeParser<...>; }'.
            //     Type '(json: string) => unknown' is not assignable to type 'TypeParser<Buffer, any>'.
            //       Types of parameters 'json' and 'value' are incompatible.
            //         Type 'Buffer' is not assignable to type 'string'.ts(2769)
            //
            // Because pg-types types expect us to handle both binary and text protocol versions,
            // where as far we can see, pg will ever pass only text version.
            //
            // @ts-expect-error
            getTypeParser: (oid: number, format?) => {
              if (format === 'text' && customParsers[oid]) {
                return customParsers[oid]
              }

              return neon.types.getTypeParser(oid, format)
            },
          },
        },
        fixArrayBufferValues(values),
      )

      return result
    } catch (e) {
      this.onError(e)
    }
  }

  protected onError(e: any): never {
    debug('Error in onError: %O', e)
    throw new DriverAdapterError(convertDriverError(e))
  }
}

class NeonTransaction extends NeonWsQueryable<neon.PoolClient> implements Transaction {
  constructor(client: neon.PoolClient, readonly options: TransactionOptions) {
    super(client)
  }

  async commit(): Promise<void> {
    debug(`[js::commit]`)

    this.client.release()
  }

  async rollback(): Promise<void> {
    debug(`[js::rollback]`)

    this.client.release()
  }
}

export type PrismaNeonOptions = {
  schema?: string
}

export class PrismaNeonAdapter extends NeonWsQueryable<neon.Pool> implements SqlDriverAdapter {
  private isRunning = true

  constructor(pool: neon.Pool, private options?: PrismaNeonOptions) {
    super(pool)
  }

  executeScript(_script: string): Promise<void> {
    throw new Error('Not implemented yet')
  }

  async startTransaction(isolationLevel?: IsolationLevel): Promise<Transaction> {
    const options: TransactionOptions = {
      usePhantomQuery: false,
    }

    const tag = '[js::startTransaction]'
    debug('%s options: %O', tag, options)

    const conn = await this.client.connect().catch((error) => this.onError(error))

    try {
      const tx = new NeonTransaction(conn, options)
      await tx.executeRaw({ sql: 'BEGIN', args: [], argTypes: [] })
      if (isolationLevel) {
        await tx.executeRaw({
          sql: `SET TRANSACTION ISOLATION LEVEL ${isolationLevel}`,
          args: [],
          argTypes: [],
        })
      }
      return tx
    } catch (error) {
      conn.release(error)
      this.onError(error)
    }
  }

  getConnectionInfo(): ConnectionInfo {
    return {
      schemaName: this.options?.schema,
      supportsRelationJoins: true,
    }
  }

  async dispose(): Promise<void> {
    if (this.isRunning) {
      await this.client.end()
      this.isRunning = false
    }
  }

  underlyingDriver(): neon.Pool {
    return this.client
  }
}

export class PrismaNeonAdapterFactory implements SqlDriverAdapterFactory {
  readonly provider = 'postgres'
  readonly adapterName = packageName

  constructor(private readonly config: neon.PoolConfig, private options?: PrismaNeonOptions) {}

  async connect(): Promise<PrismaNeonAdapter> {
    return new PrismaNeonAdapter(new neon.Pool(this.config), this.options)
  }
}

export class PrismaNeonHTTPAdapter extends NeonQueryable implements SqlDriverAdapter {
  private client: (sql: string, params: any[], opts: Record<string, any>) => neon.NeonQueryPromise<any, any>

  constructor(client: neon.NeonQueryFunction<any, any>) {
    super()
    // `client.query` is for @neondatabase/serverless v1.0.0 and up, where the
    // root query function `client` is only usable as a template function;
    // `client` is a fallback for earlier versions
    this.client = (client as any).query ?? (client as any)
  }

  executeScript(_script: string): Promise<void> {
    throw new Error('Not implemented yet')
  }

  async startTransaction(): Promise<Transaction> {
    return Promise.reject(new Error('Transactions are not supported in HTTP mode'))
  }

  override async performIO(query: SqlQuery): Promise<PerformIOResult> {
    const { sql, args: values } = query
    return await this.client(sql, values, {
      arrayMode: true,
      fullResults: true,
      // pass type parsers to neon() HTTP client, same as in WS client above
      //
      // requires @neondatabase/serverless >= 0.9.5
      // - types option added in https://github.com/neondatabase/serverless/pull/92
      types: {
        getTypeParser: (oid: number, format?) => {
          if (format === 'text' && customParsers[oid]) {
            return customParsers[oid]
          }

          return neon.types.getTypeParser(oid, format)
        },
      },
      // type `as` cast required until neon types are corrected:
      // https://github.com/neondatabase/serverless/pull/110#issuecomment-2458992991
    } as neon.HTTPQueryOptions<true, true>)
  }

  async dispose(): Promise<void> {}
}

export class PrismaNeonHTTPAdapterFactory implements SqlDriverAdapterFactory {
  readonly provider = 'postgres'
  readonly adapterName = packageName

  constructor(
    private readonly connectionString: string,
    private readonly options: neon.HTTPQueryOptions<boolean, boolean>,
  ) {}

  async connect(): Promise<SqlDriverAdapter> {
    return new PrismaNeonHTTPAdapter(neon.neon(this.connectionString, this.options))
  }
}
