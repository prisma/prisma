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
import { parse as parseArray } from 'postgres-array'

import { name as packageName } from '../package.json'
import { FIRST_NORMAL_OBJECT_ID } from './constants'
import { customParsers, fieldToColumnType, mapArg, UnsupportedNativeDataType } from './conversion'
import { convertDriverError } from './errors'

const types = pg.types

const debug = Debug('prisma:driver-adapter:pg')

type StdClient = pg.Pool
type TransactionClient = pg.PoolClient

type OidMetadata = {
  /** If > 0, this type is an array and typelem is the OID of the element type */
  typelem: number
}

/**
 * Cache to avoid repeated pg_type catalog queries.
 *
 * Memory growth consideration: The cache grows as new extension types are encountered.
 * For most applications this is negligible.
 * If memory becomes a concern in the future, consider implementing an LRU eviction policy.
 */
type OidMetadataCache = Map<number, OidMetadata>

function parseExtensionArray(arrayString: string): string[] {
  return parseArray(arrayString, (s) => s)
}

class PgQueryable<ClientT extends StdClient | TransactionClient> implements SqlQueryable {
  readonly provider = 'postgres'
  readonly adapterName = packageName

  constructor(
    protected readonly client: ClientT,
    protected readonly oidMetadataCache: OidMetadataCache,
    protected readonly pgOptions?: PrismaPgOptions,
  ) {}

  /**
   * Execute a query given as SQL, interpolating the given parameters.
   */
  async queryRaw(query: SqlQuery): Promise<SqlResultSet> {
    const tag = '[js::query_raw]'
    debug(`${tag} %O`, query)

    const { fields, rows } = await this.performIO(query)

    // Collect unknown extension OIDs that need metadata lookup
    const unknownOids = new Set<number>()
    for (const field of fields) {
      if (field.dataTypeID >= FIRST_NORMAL_OBJECT_ID && !this.oidMetadataCache.has(field.dataTypeID)) {
        unknownOids.add(field.dataTypeID)
      }
    }

    // Fetch metadata for unknown OIDs from pg_type catalog
    await this.ensureOidMetadata([...unknownOids])

    // Find extension array columns that need post-processing (arrays returned as unparsed strings)
    const extensionArrayColumnIndices: number[] = []
    for (let i = 0; i < fields.length; i++) {
      const field = fields[i]
      if (field.dataTypeID >= FIRST_NORMAL_OBJECT_ID) {
        const metadata = this.oidMetadataCache.get(field.dataTypeID)
        if (metadata && metadata.typelem > 0) {
          extensionArrayColumnIndices.push(i)
        }
      }
    }

    // Parse extension array columns that weren't handled during query execution
    for (const index of extensionArrayColumnIndices) {
      for (const row of rows) {
        const value = row[index]
        if (typeof value === 'string') {
          row[index] = parseExtensionArray(value)
        }
      }
    }

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
              if (format === 'text') {
                if (customParsers[oid]) {
                  return customParsers[oid]
                }

                // For extension types (OID >= 16384), check if this is an array type
                // based on metadata cached from pg_type catalog.
                if (oid >= FIRST_NORMAL_OBJECT_ID) {
                  const metadata = this.oidMetadataCache.get(oid)
                  if (metadata?.typelem) {
                    // This is an array type, parse it
                    return parseExtensionArray
                  }
                }
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

  /**
   * Query pg_type catalog to get metadata for custom type OIDs.
   *
   * Race condition note: Multiple concurrent queries may encounter the same unknown OID and both
   * attempt to fetch metadata. The final cache state will be correct regardless.
   */
  private async ensureOidMetadata(oids: number[]): Promise<void> {
    if (oids.length === 0) {
      return
    }

    const catalogResult = await this.performIO({
      sql: `SELECT oid, typelem FROM pg_type WHERE oid = ANY($1)`,
      args: [oids],
      argTypes: [{ arity: 'list', scalarType: 'int' }],
    })

    for (const row of catalogResult.rows) {
      const [oid, typelem] = row as [number, number]
      this.oidMetadataCache.set(oid, { typelem })
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
    readonly oidMetadataCache: OidMetadataCache,
    readonly pgOptions?: PrismaPgOptions,
    readonly cleanup?: () => void,
  ) {
    super(client, oidMetadataCache, pgOptions)
  }

  async commit(): Promise<void> {
    debug(`[js::commit]`)

    this.cleanup?.()
    this.client.release()
  }

  async rollback(): Promise<void> {
    debug(`[js::rollback]`)

    this.cleanup?.()
    this.client.release()
  }

  async createSavepoint(name: string): Promise<void> {
    await this.executeRaw({ sql: `SAVEPOINT ${name}`, args: [], argTypes: [] })
  }

  async rollbackToSavepoint(name: string): Promise<void> {
    await this.executeRaw({ sql: `ROLLBACK TO SAVEPOINT ${name}`, args: [], argTypes: [] })
  }

  async releaseSavepoint(name: string): Promise<void> {
    await this.executeRaw({ sql: `RELEASE SAVEPOINT ${name}`, args: [], argTypes: [] })
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
  private readonly adapterOidMetadataCache: OidMetadataCache

  constructor(
    client: StdClient,
    protected readonly pgOptions?: PrismaPgOptions,
    private readonly release?: () => Promise<void>,
  ) {
    const oidMetadataCache = new Map()
    super(client, oidMetadataCache, pgOptions)
    this.adapterOidMetadataCache = oidMetadataCache
  }

  async startTransaction(isolationLevel?: IsolationLevel): Promise<Transaction> {
    const options: TransactionOptions = {
      usePhantomQuery: false,
    }

    const tag = '[js::startTransaction]'
    debug('%s options: %O', tag, options)

    const conn = await this.client.connect().catch((error) => this.onError(error))
    const onError = (err: Error) => {
      debug(`Error from pool connection: ${err.message} %O`, err)
      this.pgOptions?.onConnectionError?.(err)
    }
    conn.on('error', onError)

    const cleanup = () => {
      conn.removeListener('error', onError)
    }

    try {
      const tx = new PgTransaction(conn, options, this.adapterOidMetadataCache, this.pgOptions, cleanup)
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
      cleanup()
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
