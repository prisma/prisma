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

  constructor(protected client: Connection) {}

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
      return await this.client.query(req, values)
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

class MariaDbTransaction extends MariaDbQueryable<mariadb.Connection> implements Transaction {
  constructor(
    conn: mariadb.Connection,
    readonly options: TransactionOptions,
    readonly cleanup?: () => void,
  ) {
    super(conn)
  }

  async commit(): Promise<void> {
    debug(`[js::commit]`)

    this.cleanup?.()
    await this.client.end()
  }

  async rollback(): Promise<void> {
    debug(`[js::rollback]`)

    this.cleanup?.()
    await this.client.end()
  }
}

export type PrismaMariadbOptions = {
  database?: string
  onConnectionError?: (err: mariadb.SqlError) => void
}

export type Capabilities = {
  supportsRelationJoins: boolean
}

export class PrismaMariaDbAdapter extends MariaDbQueryable<mariadb.Pool> implements SqlDriverAdapter {
  constructor(
    client: mariadb.Pool,
    private readonly capabilities: Capabilities,
    private readonly options?: PrismaMariadbOptions,
  ) {
    super(client)
  }

  executeScript(_script: string): Promise<void> {
    throw new Error('Not implemented yet')
  }

  getConnectionInfo(): ConnectionInfo {
    return {
      schemaName: this.options?.database,
      supportsRelationJoins: this.capabilities.supportsRelationJoins,
    }
  }

  async startTransaction(isolationLevel?: IsolationLevel): Promise<Transaction> {
    const options: TransactionOptions = {
      usePhantomQuery: false,
    }

    const tag = '[js::startTransaction]'
    debug('%s options: %O', tag, options)

    const conn = await this.client.getConnection().catch((error) => this.onError(error))
    const onError = (err: mariadb.SqlError) => {
      debug(`Error from connection: ${err.message} %O`, err)
      this.options?.onConnectionError?.(err)
    }
    conn.on('error', onError)

    const cleanup = () => {
      conn.removeListener('error', onError)
    }

    try {
      const tx = new MariaDbTransaction(conn, options, cleanup)
      if (isolationLevel) {
        await tx.executeRaw({
          sql: `SET TRANSACTION ISOLATION LEVEL ${isolationLevel}`,
          args: [],
          argTypes: [],
        })
      }
      await tx.executeRaw({ sql: 'BEGIN', args: [], argTypes: [] })
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
    this.#config = rewriteConnectionString(config)
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
  const supportsRelationJoins = !isMariaDB && (major > 8 || (major === 8 && minor >= 0 && patch >= 13))

  return { supportsRelationJoins }
}

/**
 * Rewrites mysql:// connection strings to mariadb:// format.
 * This allows users to use mysql:// connection strings with the MariaDB adapter.
 */
export function rewriteConnectionString(config: mariadb.PoolConfig | string): mariadb.PoolConfig | string {
  if (typeof config !== 'string') {
    return config
  }

  if (!config.startsWith('mysql://')) {
    return config
  }

  return config.replace(/^mysql:\/\//, 'mariadb://')
}

type ArrayModeResult = unknown[][] & { meta?: mariadb.FieldInfo[]; affectedRows?: number; insertId?: BigInt }
