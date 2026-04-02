import type {
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
import * as mariadb from 'mariadb'

import { name as packageName } from '../package.json'
import { mapArg, mapColumnType, mapRow, typeCast } from './conversion'
import { convertDriverError } from './errors'

const debug = Debug('prisma:driver-adapter:mariadb')

class MariaDbQueryable<Connection extends mariadb.Pool | mariadb.Connection> implements SqlQueryable {
  readonly provider = 'mysql'
  readonly adapterName = packageName

  constructor(
    protected readonly client: Connection,
    protected readonly mariadbOptions?: { useTextProtocol?: boolean },
  ) {}

  async queryRaw(query: SqlQuery): Promise<SqlResultSet> {
    const tag = '[js::query_raw]'
    debug(`${tag} %O`, query)

    const result = await this.performIO(query)
    return {
      columnNames: result.meta?.map((field) => field.name()) ?? [],
      columnTypes: result.meta?.map(mapColumnType) ?? [],
      rows: Array.isArray(result) ? result.map((row) => mapRow(row, result.meta)) : [],
      lastInsertId: result.insertId?.toString(),
    }
  }

  async executeRaw(query: SqlQuery): Promise<number> {
    const tag = '[js::execute_raw]'
    debug(`${tag} %O`, query)

    return (await this.performIO(query)).affectedRows ?? 0
  }

  protected async performIO(query: SqlQuery): Promise<ArrayModeResult> {
    const { sql, args } = query

    try {
      const req = {
        sql,
        rowsAsArray: true,
        dateStrings: true,
        // Disable automatic conversion of JSON blobs to objects.
        autoJsonMap: false,
        // Return JSON strings as strings, not objects.
        // Available in the driver, but not provided in the typings.
        jsonStrings: true,
        // Disable automatic conversion of BIT(1) to boolean.
        // Available in the driver, but not provided in the typings.
        bitOneIsBoolean: false,
        typeCast,
      }
      const values = args.map((arg, i) => mapArg(arg, query.argTypes[i]))
      const execute = this.mariadbOptions?.useTextProtocol
        ? this.client.query.bind(this.client)
        : this.client.execute.bind(this.client)
      return await execute(req, values)
    } catch (e) {
      const error = e as Error
      this.onError(error)
    }
  }

  protected onError(error: unknown): never {
    debug('Error in performIO: %O', error)
    throw new DriverAdapterError(convertDriverError(error))
  }
}

// All transaction operations use `client.query` instead of `client.execute` to avoid using the
// binary protocol, which does not support transactions in the MariaDB driver.
class MariaDbTransaction extends MariaDbQueryable<mariadb.Connection> implements Transaction {
  constructor(
    readonly conn: mariadb.Connection,
    mariadbOptions: PrismaMariadbOptions | undefined,
    readonly options: TransactionOptions,
    protected readonly cleanup?: () => void,
  ) {
    super(conn, mariadbOptions)
  }

  async commit(): Promise<void> {
    debug(`[js::commit]`)

    try {
      await this.client.query({ sql: 'COMMIT' })
    } catch (err) {
      this.onError(err)
    } finally {
      this.cleanup?.()
      await this.client.end()
    }
  }

  async rollback(): Promise<void> {
    debug(`[js::rollback]`)

    try {
      await this.client.query({ sql: 'ROLLBACK' })
    } catch (err) {
      this.onError(err)
    } finally {
      this.cleanup?.()
      await this.client.end()
    }
  }

  async createSavepoint(name: string): Promise<void> {
    await this.client.query({ sql: `SAVEPOINT ${name}` }).catch(this.onError.bind(this))
  }

  async rollbackToSavepoint(name: string): Promise<void> {
    await this.client.query({ sql: `ROLLBACK TO ${name}` }).catch(this.onError.bind(this))
  }

  async releaseSavepoint(name: string): Promise<void> {
    await this.client.query({ sql: `RELEASE SAVEPOINT ${name}` }).catch(this.onError.bind(this))
  }
}

export type PrismaMariadbOptions = {
  /** The name of the database to use in generated queries */
  database?: string
  /** Use the driver's text protocol (`query`) instead of the binary protocol (`execute`). */
  useTextProtocol?: boolean
  /** Callback attached to transaction connection `error` events. */
  onConnectionError?: (err: mariadb.SqlError) => void
}

export type Capabilities = {
  supportsRelationJoins: boolean
}

export class PrismaMariaDbAdapter extends MariaDbQueryable<mariadb.Pool> implements SqlDriverAdapter {
  constructor(
    client: mariadb.Pool,
    private readonly capabilities: Capabilities,
    protected readonly mariadbOptions?: PrismaMariadbOptions,
  ) {
    super(client, mariadbOptions)
  }

  executeScript(_script: string): Promise<void> {
    throw new Error('Not implemented yet')
  }

  getConnectionInfo(): ConnectionInfo {
    return {
      schemaName: this.mariadbOptions?.database,
      supportsRelationJoins: this.capabilities.supportsRelationJoins,
    }
  }

  async startTransaction(isolationLevel?: IsolationLevel): Promise<Transaction> {
    const options: TransactionOptions = {
      usePhantomQuery: true,
    }

    const tag = '[js::startTransaction]'
    debug('%s options: %O', tag, options)

    const conn = await this.client.getConnection().catch((error) => this.onError(error))
    const onError = (err: mariadb.SqlError) => {
      debug(`Error from connection: ${err.message} %O`, err)
      this.mariadbOptions?.onConnectionError?.(err)
    }
    conn.on('error', onError)

    const cleanup = () => {
      conn.removeListener('error', onError)
    }

    try {
      const tx = new MariaDbTransaction(conn, this.mariadbOptions, options, cleanup)
      if (isolationLevel) {
        await tx.executeRaw({
          sql: `SET TRANSACTION ISOLATION LEVEL ${isolationLevel}`,
          args: [],
          argTypes: [],
        })
      }
      // Uses `query` instead of `execute` to avoid the binary protocol.
      await tx.conn.query({ sql: 'BEGIN' }).catch(this.onError.bind(this))
      return tx
    } catch (error) {
      await conn.end()
      cleanup()
      this.onError(error)
    }
  }

  async dispose(): Promise<void> {
    await this.client.end()
  }

  underlyingDriver(): mariadb.Pool {
    return this.client
  }
}

export class PrismaMariaDbAdapterFactory implements SqlDriverAdapterFactory {
  readonly provider = 'mysql'
  readonly adapterName = packageName

  #capabilities?: Capabilities
  #config: mariadb.PoolConfig | string
  #options?: PrismaMariadbOptions

  constructor(config: mariadb.PoolConfig | string, options?: PrismaMariadbOptions) {
    if (typeof config === 'string') {
      try {
        const url = new URL(config)
        if (!url.searchParams.has('prepareCacheLength')) {
          url.searchParams.set('prepareCacheLength', '0')
        }
        this.#config = rewriteConnectionString(url).toString()
      } catch (error) {
        debug('Error parsing connection string: %O', error)
        // If we can't parse the connection string, use it as-is and let the driver fail with
        // its own error.
        this.#config = config
      }
    } else {
      if (config.prepareCacheLength === undefined) {
        this.#config = { ...config, prepareCacheLength: 0 }
      } else {
        this.#config = config
      }
    }
    this.#options = options
  }

  async connect(): Promise<PrismaMariaDbAdapter> {
    let pool: mariadb.Pool
    try {
      pool = mariadb.createPool(this.#config)
    } catch (error) {
      // We match on an error which is known to leak the connection string and replace it with
      // a custom error message.
      // The error might change in a future version of the driver, but this is covered in a
      // test, which checks for credential leakage regardless of the exact error message.
      if (error instanceof Error && error.message.startsWith('error parsing connection string')) {
        throw new Error(
          "error parsing connection string, format must be 'mariadb://[<user>[:<password>]@]<host>[:<port>]/[<db>[?<opt1>=<value1>[&<opt2>=<value2>]]]'",
        )
      }
      throw error
    }
    if (this.#capabilities === undefined) {
      this.#capabilities = await getCapabilities(pool)
    }
    return new PrismaMariaDbAdapter(pool, this.#capabilities, this.#options)
  }
}

async function getCapabilities(pool: mariadb.Pool): Promise<{ supportsRelationJoins: boolean }> {
  const tag = '[js::getCapabilities]'

  try {
    const rows = await pool.query({
      sql: `SELECT VERSION()`,
      rowsAsArray: true,
    })

    const version = rows[0][0]
    debug(`${tag} MySQL version: %s from %o`, version, rows)

    const capabilities = inferCapabilities(version)
    debug(`${tag} Inferred capabilities: %O`, capabilities)

    return capabilities
  } catch (e) {
    debug(`${tag} Error while checking capabilities: %O`, e)
    return { supportsRelationJoins: false }
  }
}

export function inferCapabilities(version: unknown): Capabilities {
  if (typeof version !== 'string') {
    return { supportsRelationJoins: false }
  }

  const [versionStr, suffix] = version.split('-')
  const [major, minor, patch] = versionStr.split('.').map((n) => parseInt(n, 10))

  // No relation-joins support for mysql < 8.0.13 or mariadb.
  const isMariaDB = suffix?.toLowerCase()?.includes('mariadb') ?? false
  const supportsRelationJoins =
    !isMariaDB && (major > 8 || (major === 8 && (minor > 0 || (minor === 0 && patch >= 13))))
  return { supportsRelationJoins }
}

/**
 * Rewrites mysql:// connection strings to mariadb:// format.
 * This allows users to use mysql:// connection strings with the MariaDB adapter.
 */
export function rewriteConnectionString(url: URL): URL {
  if (url.protocol === 'mysql:') {
    url.protocol = 'mariadb:'
  }
  return url
}

type ArrayModeResult = unknown[][] & { meta?: mariadb.FieldInfo[]; affectedRows?: number; insertId?: BigInt }
