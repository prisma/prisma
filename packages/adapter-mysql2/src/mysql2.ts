import type {
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
import { Mutex } from 'async-mutex'
/**
 * Note: we're using an older version of mysql2, due to:
 * https://github.com/sidorares/node-mysql2/issues/3202
 */
import * as sql from 'mysql2/promise'

import { name as packageName } from '../package.json'
import { fieldToColumnType, mapArg, mapRow, UnsupportedNativeDataType } from './conversion'
import { convertDriverError } from './errors'

const debug = Debug('prisma:driver-adapter:mysql2')

type StdClient = sql.Pool
type TransactionClient = sql.PoolConnection

const LOCK_TAG = Symbol()

class MySQL2Queryable<ClientT extends StdClient | TransactionClient> implements SqlQueryable {
  readonly provider = 'mysql'
  readonly adapterName = packageName

  constructor(protected readonly client: ClientT) {}

  protected async performIO(query: SqlQuery): Promise<SqlResultSet & { affectedRows?: number }> {
    const tag = '[js::performIO]'
    debug(`${tag} %O`, query)

    const args = query.args.map(mapArg)
    debug(`${tag} mapped args: %O`, args)

    try {
      // Note: mysql2's TypeScript definitions are messy wrong.
      // When you call `client.query()` with a `SELECT` query, it returns a tuple of `[rows, fields]`,
      // where `rows` is an array of columns, and `fields` is an array of field metadata (containing column type, name, etc).
      // When you call `client.query()` with a non-`SELECT` query, it returns a single `rows` object with `fieldCount === 0`,
      // `insertId`, etc, and `fields` is undefined.
      const performClientQuery = (
        query: SqlQuery,
      ): Promise<[sql.RowDataPacket[], sql.FieldPacket[]] | [sql.ResultSetHeader, undefined]> => {
        return this.client.query({
          sql: query.sql,
          values: args,
          rowsAsArray: true, // This is important to ensure we get an array of arrays as rows
        }) as Promise<any>
      }

      const [rows, fields] = await performClientQuery(query)

      if (fields === undefined) {
        // If we didn't run a `SELECT` query, we return the number of affected rows.
        const affectedRows = (rows as sql.ResultSetHeader).affectedRows

        return {
          affectedRows,
          lastInsertId: rows.insertId !== 0 ? rows['insertId'].toString(10) : undefined,

          columnNames: [],
          columnTypes: [],
          rows: [],
        }
      }

      const columnNames = fields.map((field) => field.name)
      const columnTypes = fields.map((field) => fieldToColumnType(field.type ?? field.columnType))

      return {
        columnNames,
        columnTypes,
        rows: rows.map((row) => mapRow(columnTypes)(row as unknown[])),
      }
    } catch (error) {
      onError(error as Error)
    }
  }

  /**
   * Execute a query given as SQL, interpolating the given parameters.
   */
  async queryRaw(query: SqlQuery): Promise<SqlResultSet> {
    const tag = '[js::query_raw]'
    debug(`${tag} %O`, query)

    const { columnNames, columnTypes, rows } = await this.performIO(query)

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

    const { affectedRows } = await this.performIO(query)
    return affectedRows ?? 0
  }
}

type DatabaseError = Error & { errno: number; sqlState: string }

function isDatabaseError(error: Error): error is DatabaseError {
  return (
    'errno' in error &&
    'sqlState' in error &&
    typeof error['errno'] === 'number' &&
    typeof error['sqlState'] === 'string'
  )
}

function onError(error: Error): never {
  debug('Error: %O', error)

  if (isDatabaseError(error)) {
    throw new DriverAdapterError(
      convertDriverError({
        code: error.errno,
        message: error.message,
        state: error.sqlState,
      }),
    )
  }

  if (error instanceof DriverAdapterError) {
    throw error
  }

  if (error instanceof UnsupportedNativeDataType) {
    throw new DriverAdapterError({
      kind: 'UnsupportedNativeDataType',
      type: error.type,
    })
  }

  // For generic errors, just rethrow as DriverAdapterError with mysql error type
  throw new DriverAdapterError({
    kind: 'mysql',
    code: 0,
    message: error.message || 'Unknown error',
    state: 'HY000',
  })
}

class MySQL2Transaction extends MySQL2Queryable<TransactionClient> implements Transaction {
  [LOCK_TAG] = new Mutex()
  private released = false

  constructor(client: sql.PoolConnection, readonly options: TransactionOptions, readonly unlockParent: () => void) {
    super(client)
  }

  async performIO(query: SqlQuery): Promise<SqlResultSet & { affectedRows?: number }> {
    const release = await this[LOCK_TAG].acquire()
    try {
      if (this.released) {
        throw new Error('Transaction has been released and cannot be used anymore')
      }
      return await super.performIO(query)
    } finally {
      release()
    }
  }

  private safeRelease(): void {
    if (!this.released) {
      this.released = true
      try {
        this.client.release()
      } catch (error) {
        debug('[js::safeRelease] Failed to release connection: %O', error)
        // Don't throw here to avoid masking original errors
      }
    }
  }

  async commit(): Promise<void> {
    debug(`[js::commit]`)

    if (this.released) {
      debug('[js::commit] Transaction already released')
      return
    }

    try {
      await this.client.commit()
    } catch (error) {
      onError(error as Error)
    } finally {
      this.safeRelease()
      this.unlockParent()
    }
  }

  async rollback(): Promise<void> {
    debug(`[js::rollback]`)

    if (this.released) {
      debug('[js::rollback] Transaction already released')
      this.unlockParent()
      return
    }

    try {
      await this.client.rollback()
    } catch (error) {
      debug(`[js::rollback] Error during rollback: %O`, error)
      // Don't throw rollback errors, just log them
    } finally {
      this.safeRelease()
      this.unlockParent()
    }
  }
}

export type PrismaMySQL2Options = {
  schema?: string
  supportsRelationJoins: boolean
}

const LOCK_TAG_ACQUIRE_CONNECTION = Symbol()

export class PrismaMySQL2Adapter extends MySQL2Queryable<StdClient> implements SqlDriverAdapter {
  [LOCK_TAG_ACQUIRE_CONNECTION] = new Mutex()

  constructor(client: sql.Pool, private options: PrismaMySQL2Options, private readonly release: () => Promise<void>) {
    super(client)
  }

  async startTransaction(isolationLevel?: IsolationLevel): Promise<Transaction> {
    const options: TransactionOptions = {
      usePhantomQuery: true,
    }

    const tag = '[js::startTransaction]'
    debug('%s options: %O', tag, options)

    const releaseLock = await this[LOCK_TAG_ACQUIRE_CONNECTION].acquire()
    let conn: sql.PoolConnection | undefined
    let transactionStarted = false

    try {
      conn = await this.client.getConnection()
      debug('%s Got connection from pool', tag)

      // Set isolation level if specified
      if (isolationLevel) {
        await conn.query(`SET TRANSACTION ISOLATION LEVEL ${isolationLevel}`)
      }

      // Start the transaction
      await conn.beginTransaction()
      transactionStarted = true
      debug('%s Transaction started', tag)

      const tx = new MySQL2Transaction(conn, options, releaseLock)

      // Transfer ownership of connection and lock to transaction
      // Clear local references to avoid double cleanup
      conn = undefined

      return tx
    } catch (error) {
      debug('%s Error during transaction start: %O', tag, error)

      // Clean up resources on error
      if (conn) {
        try {
          if (transactionStarted) {
            await conn.rollback()
          }
        } catch (rollbackError) {
          debug('%s Error during rollback cleanup: %O', tag, rollbackError)
        }

        try {
          conn.release()
        } catch (releaseError) {
          debug('%s Error during connection release: %O', tag, releaseError)
        }
      }

      releaseLock()
      onError(error as Error)
    }
  }

  async executeScript(script: string): Promise<void> {
    // TODO: crude implementation for now, might need to refine it
    const statements = script
      .split(';')
      .map((stmt) => stmt.trim())
      .filter((stmt) => stmt.length > 0)

    for (const stmt of statements) {
      try {
        await this.client.query(stmt)
      } catch (error) {
        onError(error as Error)
      }
    }
  }

  getConnectionInfo(): ConnectionInfo {
    return {
      schemaName: this.options?.schema,
      supportsRelationJoins: this.options.supportsRelationJoins,
    }
  }

  async dispose(): Promise<void> {
    debug('[js::dispose] Disposing adapter')

    await this.release()
    this.client.destroy()
  }
}

/**
 * Extracts the capabilities of the MySQL server, based on its version.
 * This function never throws. On error, it returns the default capabilities.
 */
async function getCapabilities(pool: sql.Pool): Promise<{ supportsRelationJoins: boolean }> {
  const tag = '[js::getCapabilities]'

  try {
    const [rows] = await pool.query<sql.RowDataPacket[]>({
      sql: `SELECT VERSION()`,
      rowsAsArray: true,
    })

    const version = rows[0][0] as `${number}.${number}.${number}${'-MariaDB' | ''}`
    debug(`${tag} MySQL version: %s from %o`, version, rows)

    const isMariaDB = version.toLowerCase().includes('mariadb')
    debug(`${tag} Is MariaDB: %s`, isMariaDB)

    // No relation-joins support for mysql < 8.0.13 or mariadb.
    const supportsRelationJoins =
      !isMariaDB &&
      (() => {
        const [major, minor, patch] = version.split('.').map((x) => parseInt(x, 10))
        return major > 8 || (major === 8 && minor >= 0 && patch >= 13)
      })()
    debug(`${tag} Supports relation joins: %s`, supportsRelationJoins)

    return {
      supportsRelationJoins,
    }
  } catch (e) {
    debug(`${tag} Error while checking capabilities: %O`, e)
    return {
      // fallback to default capabilities
      supportsRelationJoins: false,
    }
  }
}

export class PrismaMySQL2AdapterFactory implements SqlMigrationAwareDriverAdapterFactory {
  readonly provider = 'mysql'
  readonly adapterName = packageName

  static #defaultConfig = {
    database: 'mysql',
    // https://sidorares.github.io/node-mysql2/docs/documentation/connect-on-cloudflare#mysql2-connection
    // read JSON datatypes as strings
    disableEval: true,
    jsonStrings: true,
    // read datetime as string
    dateStrings: true,
    // interpret dates as UTC
    timezone: 'Z',
    supportBigNumbers: true,
  } satisfies sql.PoolOptions

  constructor(private readonly config: sql.PoolOptions, private readonly options?: PrismaMySQL2Options) {}

  async connect(): Promise<SqlDriverAdapter> {
    const config = { ...PrismaMySQL2AdapterFactory.#defaultConfig, ...this.config } satisfies sql.PoolOptions
    const pool = sql.createPool(config)

    const dispose = async () => {
      debug('[js::dispose] Disposing pool')
      try {
        await Promise.race([
          pool.end(),
          new Promise((_, reject) => setTimeout(() => reject(new Error('Pool end timeout')), 5000)),
        ])
      } catch (error) {
        debug('[js::dispose] Error during pool.end(): %O', error)
        // Force close if graceful shutdown fails
        pool.destroy()
      }
    }

    const capabilities = await getCapabilities(pool)
    const options = { schema: config.database, ...capabilities, ...this.options } satisfies PrismaMySQL2Options

    return new PrismaMySQL2Adapter(pool, options, dispose)
  }

  async connectToShadowDb(): Promise<SqlDriverAdapter> {
    const conn = await this.connect()
    const database = `prisma_migrate_shadow_db_${globalThis.crypto.randomUUID()}`
    await conn.executeScript(`CREATE DATABASE \`${database}\``)

    const config = { ...PrismaMySQL2AdapterFactory.#defaultConfig, ...this.config, database }
    const pool = sql.createPool(config)

    const capabilities = await getCapabilities(pool)
    const options = { schema: config.database, ...capabilities, ...this.options } satisfies PrismaMySQL2Options

    return new PrismaMySQL2Adapter(pool, options, async () => pool.end())
  }
}

export type ParsedDatabaseError = {
  message: string
  code: number
  state: string
}
