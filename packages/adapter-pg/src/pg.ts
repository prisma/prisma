/* eslint-disable @typescript-eslint/require-await */

import type {
  ColumnType,
  ConnectionInfo,
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
// @ts-ignore: this is used to avoid the `Module '"<path>/node_modules/@types/pg/index"' has no default export.` error.
import pg from 'pg'

import { name as packageName } from '../package.json'
import { FIRST_NORMAL_OBJECT_ID } from './constants'
import { customParsers, fieldToColumnType, mapArg, UnsupportedNativeDataType } from './conversion'
import { convertDriverError } from './errors'

const types = pg.types

const debug = Debug('prisma:driver-adapter:pg')

type StdClient = pg.Pool
type TransactionClient = pg.PoolClient

class PgQueryable<ClientT extends StdClient | TransactionClient> implements SqlQueryable {
  readonly provider = 'postgres'
  readonly adapterName = packageName

  constructor(
    protected readonly client: ClientT,
    protected readonly pgOptions?: PrismaPgOptions,
  ) {}

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

    const udtParser = this.pgOptions?.userDefinedTypeParser
    if (udtParser) {
      for (let i = 0; i < fields.length; i++) {
        const field = fields[i]
        if (field.dataTypeID >= FIRST_NORMAL_OBJECT_ID && !Object.hasOwn(customParsers, field.dataTypeID)) {
          for (let j = 0; j < rows.length; j++) {
            rows[j][i] = await udtParser(field.dataTypeID, rows[j][i], this)
          }
        }
      }
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
  private async performIO(query: SqlQuery): Promise<pg.QueryArrayResult<any>> {
    const { sql, args } = query
    const values = args.map((arg, i) => mapArg(arg, query.argTypes[i]))

    try {
      const result = await this.client.query(
        {
          text: sql,
          values,
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
        values,
      )

      return result
    } catch (e) {
      this.onError(e)
    }
  }

  protected onError(error: unknown): never {
    debug('Error in performIO: %O', error)
    throw new DriverAdapterError(convertDriverError(error))
  }
}

class PgTransaction extends PgQueryable<TransactionClient> implements Transaction {
  constructor(
    client: pg.PoolClient,
    readonly options: TransactionOptions,
    readonly pgOptions?: PrismaPgOptions,
  ) {
    super(client, pgOptions)
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

export type PrismaPgOptions = {
  schema?: string
  disposeExternalPool?: boolean
  onPoolError?: (err: Error) => void
  onConnectionError?: (err: Error) => void
  userDefinedTypeParser?: UserDefinedTypeParser
}

export type UserDefinedTypeParser = (oid: number, value: unknown, adapter: SqlQueryable) => Promise<unknown>

export class PrismaPgAdapter extends PgQueryable<StdClient> implements SqlDriverAdapter {
  constructor(
    client: StdClient,
    protected readonly pgOptions?: PrismaPgOptions,
    private readonly release?: () => Promise<void>,
  ) {
    super(client)
  }

  async startTransaction(isolationLevel?: IsolationLevel): Promise<Transaction> {
    const options: TransactionOptions = {
      usePhantomQuery: false,
    }

    const tag = '[js::startTransaction]'
    debug('%s options: %O', tag, options)

    const conn = await this.client.connect().catch((error) => this.onError(error))
    conn.on('error', (err) => {
      debug(`Error from pool connection: ${err.message} %O`, err)
      this.pgOptions?.onConnectionError?.(err)
    })

    try {
      const tx = new PgTransaction(conn, options)
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

  async executeScript(script: string): Promise<void> {
    // FIXME: there's no guarantee that the semicolon is between statements
    // and not inside one.
    const statements = script
      .split(';')
      .map((stmt) => stmt.trim())
      .filter((stmt) => stmt.length > 0)

    for (const stmt of statements) {
      try {
        await this.client.query(stmt)
      } catch (error) {
        this.onError(error)
      }
    }
  }

  getConnectionInfo(): ConnectionInfo {
    return {
      schemaName: this.pgOptions?.schema,
      supportsRelationJoins: true,
    }
  }

  async dispose(): Promise<void> {
    return this.release?.()
  }

  underlyingDriver(): pg.Pool {
    return this.client
  }
}

export class PrismaPgAdapterFactory implements SqlMigrationAwareDriverAdapterFactory {
  readonly provider = 'postgres'
  readonly adapterName = packageName
  private readonly config: pg.PoolConfig
  private externalPool: pg.Pool | null

  constructor(
    poolOrConfig: pg.Pool | pg.PoolConfig,
    private readonly options?: PrismaPgOptions,
  ) {
    if (poolOrConfig instanceof pg.Pool) {
      this.externalPool = poolOrConfig
      this.config = poolOrConfig.options
    } else {
      this.externalPool = null
      this.config = poolOrConfig
    }
  }

  async connect(): Promise<PrismaPgAdapter> {
    const client = this.externalPool ?? new pg.Pool(this.config)

    const onIdleClientError = (err: Error) => {
      debug(`Error from idle pool client: ${err.message} %O`, err)
      this.options?.onPoolError?.(err)
    }
    client.on('error', onIdleClientError)

    return new PrismaPgAdapter(client, this.options, async () => {
      if (this.externalPool) {
        if (this.options?.disposeExternalPool) {
          await this.externalPool.end()
          this.externalPool = null
        } else {
          this.externalPool.removeListener('error', onIdleClientError)
        }
      } else {
        await client.end()
      }
    })
  }

  async connectToShadowDb(): Promise<PrismaPgAdapter> {
    const conn = await this.connect()
    const database = `prisma_migrate_shadow_db_${globalThis.crypto.randomUUID()}`
    await conn.executeScript(`CREATE DATABASE "${database}"`)

    const client = new pg.Pool({ ...this.config, database })
    return new PrismaPgAdapter(client, undefined, async () => {
      await conn.executeScript(`DROP DATABASE "${database}"`)
      await client.end()
    })
  }
}
