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
import * as sql from 'mysql2/promise'

import { name as packageName } from '../package.json'
import { fieldToColumnType, mapArg, UnsupportedNativeDataType } from './conversion'
import { convertDriverError } from './errors'

const debug = Debug('prisma:driver-adapter:mysql2')

type StdClient = sql.Pool
type TransactionClient = sql.PoolConnection

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
        rows: rows as unknown[][],
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

function onError(error: Error): never {
  if (error instanceof UnsupportedNativeDataType) {
    throw new DriverAdapterError({
      kind: 'UnsupportedNativeDataType',
      type: error.type,
    })
  }

  if (error.name === 'DatabaseError') {
    const parsed = parseErrorMessage(error.message)
    if (parsed) {
      throw new DriverAdapterError(convertDriverError(parsed))
    }
  }
  debug('Error in performIO: %O', error)
  throw error
}

function parseErrorMessage(error: string): ParsedDatabaseError | undefined {
  const regex = /^(.*) \(errno (\d+)\) \(sqlstate ([A-Z0-9]+)\)/
  let match: RegExpMatchArray | null = null

  while (true) {
    const result = error.match(regex)
    if (result === null) {
      break
    }

    // Try again with the rest of the error message. The driver can return multiple
    // concatenated error messages.
    match = result
    error = match[1]
  }

  if (match !== null) {
    const [, message, codeAsString, sqlstate] = match
    const code = Number.parseInt(codeAsString, 10)

    return {
      message,
      code,
      state: sqlstate,
    }
  } else {
    return undefined
  }
}

const LOCK_TAG = Symbol()

class MySQL2Transaction extends MySQL2Queryable<TransactionClient> implements Transaction {
  [LOCK_TAG] = new Mutex()

  constructor(client: sql.PoolConnection, readonly options: TransactionOptions) {
    super(client)
  }

  protected override async performIO(query: SqlQuery) {
    const tag = '[js::performIO]'
    debug(`${tag} %O`, query)

    console.warn('[MySQL2Transaction::performIO]')
    const releaseTx = await this[LOCK_TAG].acquire()
    console.warn('[MySQL2Transaction::performIO] acquired lock')
    try {
      const result = await super.performIO(query)
      return result
    } finally {
      releaseTx()
      console.warn('[MySQL2Transaction::performIO] released lock')
    }
  }

  async commit(): Promise<void> {
    debug(`[js::commit]`)

    console.warn('[MySQL2Transaction::commit]')
    try {
      await this.client.commit()
      console.warn('[MySQL2Transaction::commit] client committed')
    } finally {
      this.client.release()
      console.warn('[MySQL2Transaction::commit] client released')
    }
  }

  async rollback(): Promise<void> {
    debug(`[js::rollback]`)

    console.warn('[MySQL2Transaction::rollback]')
    try {
      await this.client.rollback()
      console.warn('[MySQL2Transaction::rollback] client rolled back')
    } finally {
      this.client.release()
      console.warn('[MySQL2Transaction::rollback] client released')
    }
  }
}

export type PrismaMySQL2Options = {
  schema?: string
  supportsRelationJoins: boolean
}

export class PrismaMySQL2Adapter extends MySQL2Queryable<StdClient> implements SqlDriverAdapter {
  constructor(client: sql.Pool, private options: PrismaMySQL2Options, private readonly release?: () => Promise<void>) {
    super(client)
  }

  async startTransaction(isolationLevel?: IsolationLevel): Promise<Transaction> {
    const options: TransactionOptions = {
      usePhantomQuery: false,
    }

    const tag = '[js::startTransaction]'
    debug('%s options: %O', tag, options)

    let conn: sql.PoolConnection | undefined

    try {
      // Note: mysql2's TypeScript definitions are wrong.
      // You can't call `Pool.prototype.beginTransaction()`. You need to retrieve a PoolConnection first,
      // and then call `PoolConnection.prototype.beginTransaction()`.
      conn = await this.client.getConnection()
      await conn.beginTransaction()

      const tx = new MySQL2Transaction(conn, options)
      if (isolationLevel) {
        await tx.executeRaw({
          sql: `SET TRANSACTION ISOLATION LEVEL ${isolationLevel}`,
          args: [],
          argTypes: [],
        })
      }
      return tx
    } catch (error) {
      if (conn) {
        conn.release()
      }
      onError(error)
    }
  }

  async executeScript(script: string): Promise<void> {
    // TODO: crude implementation for now, might need to refine it
    for (const stmt of script.split(';')) {
      try {
        await this.client.query(stmt)
      } catch (error) {
        onError(error)
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
    console.log('[PrismaMySQL2Adapter::dispose]')
    await this.release?.()
    console.log('[PrismaMySQL2Adapter::dispose] client released')
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
      supportsRelationJoins: true,
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
    disableEval: true,
    // read JSON datatypes as strings
    jsonStrings: true,
  } satisfies sql.PoolOptions

  constructor(private readonly config: sql.PoolOptions, private readonly options?: PrismaMySQL2Options) {}

  async connect(): Promise<SqlDriverAdapter> {
    const config = { ...PrismaMySQL2AdapterFactory.#defaultConfig, ...this.config } satisfies sql.PoolOptions
    const pool = sql.createPool(config)

    const capabilities = await getCapabilities(pool)
    const options = { schema: config.database, ...capabilities, ...this.options } satisfies PrismaMySQL2Options

    return new PrismaMySQL2Adapter(pool, options, async () => await pool.end())
  }

  async connectToShadowDb(): Promise<SqlDriverAdapter> {
    const conn = await this.connect()
    const database = `prisma_migrate_shadow_db_${globalThis.crypto.randomUUID()}`
    await conn.executeScript(`CREATE DATABASE "${database}"`)

    const config = { ...PrismaMySQL2AdapterFactory.#defaultConfig, ...this.config, database }
    const pool = sql.createPool(config)

    const capabilities = await getCapabilities(pool)
    const options = { schema: config.database, ...capabilities, ...this.options } satisfies PrismaMySQL2Options

    return new PrismaMySQL2Adapter(pool, options, async () => {
      try {
        await conn.executeScript(`DROP DATABASE "${database}"`)
      } catch (error) {
        console.warn('Failed to drop shadow database:', error)
      }

      try {
        await conn.dispose()
      } catch (error) {
        console.warn('Failed to dispose shadow connection:', error)
      }

      try {
        await pool.end()
      } catch (error) {
        console.warn('Failed to end shadow pool:', error)
      }
    })
  }
}

export type ParsedDatabaseError = {
  message: string
  code: number
  state: string
}
