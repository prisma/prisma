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
import * as sql from 'mysql2/promise'

import { name as packageName } from '../package.json'
import { fieldToColumnType, UnsupportedNativeDataType } from './conversion'
import { convertDriverError } from './errors'

const debug = Debug('prisma:driver-adapter:mysql2')

type StdClient = sql.Pool
type TransactionClient = sql.PoolConnection

class MySQL2Queryable<ClientT extends StdClient | TransactionClient> implements SqlQueryable {
  readonly provider = 'mysql'
  readonly adapterName = packageName

  constructor(protected readonly client: ClientT) {}

  /**
   * Execute a query given as SQL, interpolating the given parameters.
   */
  async queryRaw(query: SqlQuery): Promise<SqlResultSet> {
    const tag = '[js::query_raw]'
    debug(`${tag} %O`, query)

    // Note: mysql2's TypeScript definitions are messy wrong.
    // When you call `client.query()` with a `SELECT` query, it returns a tuple of `[rows, fields]`,
    // where `rows` is an array of columns, and `fields` is an array of field metadata (containing column type, name, etc).
    // When you call `client.query()` with a non-`SELECT` query, it returns a single `rows` object with `fieldCount === 0`,
    // `insertId`, etc, and `fields` is undefined.
    const clientQuery = (query: SqlQuery): Promise<[sql.RowDataPacket[], sql.FieldPacket[]] | [sql.ResultSetHeader, undefined]> => {
      return this.client.query({
        sql: query.sql,
        values: query.args,
        rowsAsArray: true, // This is important to ensure we get an array of arrays as rows
      }) as Promise<any>
    }

    const [rows, fields] = await clientQuery(query)

    if (fields === undefined) {
      // If there are no fields, we return an empty result set.
      // This is the case for queries like `INSERT`, `UPDATE`, etc.
      return {
        columnNames: [],
        columnTypes: [],
        rows: [],
        // Note: by default, mysql2 returns `insertId = 0`.
        lastInsertId: rows.insertId !== 0 ? rows['insertId'].toString(10) : undefined,
      }
    }

    const columnNames = fields.map((field) => field.name)
    let columnTypes: ColumnType[] = []

    try {
      columnTypes = fields.map((field) => fieldToColumnType(field.type ?? field.columnType))
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
      rows: rows as unknown[][],
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

    const [result] = await this.client.query<sql.ResultSetHeader>({
      sql: query.sql,
      values: query.args,
    })

    // Note: `affectedRows` can sometimes be null (e.g., when executing `"BEGIN"`)
    return result.affectedRows ?? 0
  }
}


function onError(error: Error): never {
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

class MySQL2Transaction extends MySQL2Queryable<TransactionClient> implements Transaction {
  constructor(client: sql.PoolConnection, readonly options: TransactionOptions) {
    super(client)
  }

  async commit(): Promise<void> {
    debug(`[js::commit]`)

    await this.client.commit()
  }

  async rollback(): Promise<void> {
    debug(`[js::rollback]`)

    await this.client.rollback()
  }
}

export type PrismaMySQL2Options = {
  schema?: string
}

export class PrismaMySQL2Adapter extends MySQL2Queryable<StdClient> implements SqlDriverAdapter {
  constructor(client: sql.Pool, private options?: PrismaMySQL2Options, private readonly release?: () => Promise<void>) {
    super(client)
  }

  async startTransaction(isolationLevel?: IsolationLevel): Promise<Transaction> {
    const options: TransactionOptions = {
      usePhantomQuery: false,
    }

    const tag = '[js::startTransaction]'
    debug('%s options: %O', tag, options)

    // Note: mysql2's TypeScript definitions are wrong.
    // You can't call `Pool.prototype.beginTransaction()`. You need to retrieve a PoolConnection first,
    // and then call `PoolConnection.prototype.beginTransaction()`.
    const conn = await this.client.getConnection();
    await conn.beginTransaction();

    try {
      const tx = new MySQL2Transaction(conn, options)
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
      conn.release()
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
      supportsRelationJoins: true,
    }
  }

  async dispose(): Promise<void> {
    await this.release?.()
    return await this.client.end()
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
    const options = { schema: config.database, ...this.options } satisfies PrismaMySQL2Options
    return new PrismaMySQL2Adapter(sql.createPool(config), options, async () => {})
  }

  async connectToShadowDb(): Promise<SqlDriverAdapter> {
    const conn = await this.connect()
    const database = `prisma_migrate_shadow_db_${globalThis.crypto.randomUUID()}`
    await conn.executeScript(`CREATE DATABASE "${database}"`)

    const config = { ...PrismaMySQL2AdapterFactory.#defaultConfig, ...this.config, database }

    return new PrismaMySQL2Adapter(sql.createPool(config), undefined, async () => {
      await conn.executeScript(`DROP DATABASE "${database}"`)
      // Note: no need to call dispose here. This callback is run as part of dispose.
    })
  }
}

export type ParsedDatabaseError = {
  message: string
  code: number
  state: string
}
