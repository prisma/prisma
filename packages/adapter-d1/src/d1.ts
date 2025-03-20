/* eslint-disable @typescript-eslint/require-await */

import type { D1Database, D1Meta, D1Response } from '@cloudflare/workers-types'
import {
  ConnectionInfo,
  Debug,
  DriverAdapterError,
  IsolationLevel,
  SqlDriverAdapter,
  SqlMigrationAwareDriverAdapterFactory,
  SqlQuery,
  SqlQueryable,
  SqlResultSet,
  Transaction,
  TransactionOptions,
} from '@prisma/driver-adapter-utils'
import { blue, cyan, red, yellow } from 'kleur/colors'
import ky, { KyInstance, Options as KyOptions } from 'ky'

import { name as packageName } from '../package.json'
import { getColumnTypes, mapRow } from './conversion'
import { cleanArg, matchSQLiteErrorCode } from './utils'

const debug = Debug('prisma:driver-adapter:d1')

type D1ResultsWithColumnNames = [string[], unknown[][]]
type PerformIOResult = D1ResultsWithColumnNames | D1Response
type StdClient = D1Database

/**
 * Env binding.
 */

class D1Queryable<ClientT extends StdClient> implements SqlQueryable {
  readonly provider = 'sqlite'
  readonly adapterName = packageName

  constructor(protected readonly client: ClientT) {}

  /**
   * Execute a query given as SQL, interpolating the given parameters.
   */
  async queryRaw(query: SqlQuery): Promise<SqlResultSet> {
    const tag = '[js::query_raw]'
    debug(`${tag} %O`, query)

    const data = await this.performIO(query)
    const convertedData = this.convertData(data as D1ResultsWithColumnNames)
    return convertedData
  }

  private convertData(ioResult: D1ResultsWithColumnNames): SqlResultSet {
    const columnNames = ioResult[0]
    const results = ioResult[1]

    if (results.length === 0) {
      return {
        columnNames: [],
        columnTypes: [],
        rows: [],
      }
    }

    const columnTypes = Object.values(getColumnTypes(columnNames, results))
    const rows = results.map((value) => mapRow(value, columnTypes))

    return {
      columnNames,
      // * Note: without Object.values the array looks like
      // * columnTypes: [ id: 128 ],
      // * and errors with:
      // * ✘ [ERROR] A hanging Promise was canceled. This happens when the worker runtime is waiting for a Promise from JavaScript to resolve, but has detected that the Promise cannot possibly ever resolve because all code and events related to the Promise's I/O context have already finished.
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

    const result = await this.performIO(query, true)
    return (result as D1Response).meta.changes ?? 0
  }

  private async performIO(query: SqlQuery, executeRaw = false): Promise<PerformIOResult> {
    try {
      query.args = query.args.map((arg, i) => cleanArg(arg, query.argTypes[i]))

      const stmt = this.client.prepare(query.sql).bind(...query.args)

      if (executeRaw) {
        return await stmt.run()
      } else {
        const [columnNames, ...rows] = await stmt.raw({ columnNames: true })
        return [columnNames, rows]
      }
    } catch (e) {
      onError(e as Error)
    }
  }
}

class D1Transaction extends D1Queryable<StdClient> implements Transaction {
  constructor(client: StdClient, readonly options: TransactionOptions) {
    super(client)
  }

  async commit(): Promise<void> {
    debug(`[js::commit]`)
  }

  async rollback(): Promise<void> {
    debug(`[js::rollback]`)
  }
}

export class PrismaD1Adapter extends D1Queryable<StdClient> implements SqlDriverAdapter {
  readonly tags = {
    error: red('prisma:error'),
    warn: yellow('prisma:warn'),
    info: cyan('prisma:info'),
    query: blue('prisma:query'),
  }

  alreadyWarned = new Set()

  constructor(client: StdClient, private readonly release?: () => Promise<void>) {
    super(client)
  }

  /**
   * This will warn once per transaction
   * e.g. the following two explicit transactions
   * will only trigger _two_ warnings
   *
   * ```ts
   * await prisma.$transaction([ ...queries ])
   * await prisma.$transaction([ ...moreQueries ])
   * ```
   */
  private warnOnce = (key: string, message: string, ...args: unknown[]) => {
    if (!this.alreadyWarned.has(key)) {
      this.alreadyWarned.add(key)
      console.info(`${this.tags.warn} ${message}`, ...args)
    }
  }

  async executeScript(script: string): Promise<void> {
    try {
      await this.client.exec(script)
    } catch (error) {
      onError(error as Error)
    }
  }

  getConnectionInfo(): ConnectionInfo {
    return {
      maxBindValues: 98,
    }
  }

  async startTransaction(isolationLevel?: IsolationLevel): Promise<Transaction> {
    if (isolationLevel && isolationLevel !== 'SERIALIZABLE') {
      throw new DriverAdapterError({
        kind: 'InvalidIsolationLevel',
        level: isolationLevel,
      })
    }

    this.warnOnce(
      'D1 Transaction',
      "Cloudflare D1 does not support transactions yet. When using Prisma's D1 adapter, implicit & explicit transactions will be ignored and run as individual queries, which breaks the guarantees of the ACID properties of transactions. For more details see https://pris.ly/d/d1-transactions",
    )

    const options: TransactionOptions = {
      usePhantomQuery: true,
    }

    const tag = '[js::startTransaction]'
    debug('%s options: %O', tag, options)

    return new D1Transaction(this.client, options)
  }

  async dispose(): Promise<void> {
    await this.release?.()
  }
}

export class PrismaD1AdapterFactory implements SqlMigrationAwareDriverAdapterFactory {
  readonly provider = 'sqlite'
  readonly adapterName = packageName

  constructor(private client: StdClient) {}

  async connect(): Promise<SqlDriverAdapter> {
    return new PrismaD1Adapter(this.client, async () => {})
  }

  async connectToShadowDb(): Promise<SqlDriverAdapter> {
    const { Miniflare } = await import('miniflare')

    const mf = new Miniflare({
      modules: true,
      d1Databases: {
        db: globalThis.crypto.randomUUID(),
      },
      script: `
      export default {
        async fetch(request, env, ctx) {}
      }
      `,
    })
    const db = await mf.getD1Database('db')
    return new PrismaD1Adapter(db, () => mf.dispose())
  }
}

function onError(error: Error): never {
  console.error('Error in performIO: %O', error)
  const { message } = error

  throw new DriverAdapterError({
    kind: 'sqlite',
    extendedCode: matchSQLiteErrorCode(message),
    message,
  })
}

/**
 * HTTP API binding.
 */

type D1HTTPResponseInfo = {
  code: number // >= 1000
  message: string
}

type D1HTTPRawResult = {
  meta?: Partial<D1Meta>
  results?: {
    columns?: string[]
    rows?: unknown[][]
  }
  success?: boolean
}

function onHTTPError(error: Error): never {
  debug('HTTP Error: %O', error)
  const { message } = error

  throw new DriverAdapterError({
    kind: 'sqlite',
    extendedCode: 1,
    message,
  })
}

async function performRawQuery(client: KyInstance, options: KyOptions) {
  try {
    const response = (await client.post('raw', options).json()) as {
      errors: D1HTTPResponseInfo[]
      messages: D1HTTPResponseInfo[]
      result: D1HTTPRawResult[]
      success?: true
    }

    const tag = '[js::performRawQuery]'
    debug(`${tag} %O`, {
      success: response.success,
      errors: response.errors,
      messages: response.messages,
      result: response.result,
    })

    if (!response.success) {
      throw new Error(response.errors[0].message, { cause: response.errors[0].code })
    }

    return response.result
  } catch (e) {
    onHTTPError(e as Error)
  }
}

type D1HTTPParams = {
  CLOUDFLARE_D1_TOKEN: string
  CLOUDFLARE_ACCOUNT_ID: string
  CLOUDFLARE_DATABASE_ID: string
  CLOUDFLARE_SHADOW_DATABASE_ID?: string
}

class D1HTTPQueryable implements SqlQueryable {
  readonly provider = 'sqlite'
  readonly adapterName = `${packageName}-http`

  constructor(protected readonly client: KyInstance) {}

  /**
   * Execute a query given as SQL, interpolating the given parameters.
   */
  async queryRaw(query: SqlQuery): Promise<SqlResultSet> {
    const tag = '[js::query_raw]'
    debug(`${tag} %O`, query)

    const data = await this.performIO(query)
    const convertedData = this.convertData(data)
    return convertedData
  }

  private convertData({ columnNames, rows: results }: { columnNames: string[]; rows: unknown[][] }): SqlResultSet {
    if (results.length === 0) {
      return {
        columnNames: [],
        columnTypes: [],
        rows: [],
      }
    }

    const columnTypes = getColumnTypes(columnNames, results)
    const rows = results.map((value) => mapRow(value, columnTypes))

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

    const result = await this.performIO(query)
    return result.affectedRows ?? 0
  }

  private async performIO(
    query: SqlQuery,
  ): Promise<{ columnNames: string[]; rows: unknown[][]; affectedRows?: number }> {
    try {
      query.args = query.args.map((arg, i) => cleanArg(arg, query.argTypes[i]))

      const body = {
        json: {
          sql: query.sql,
          params: query.args,
        },
      }

      const tag = '[js::perform_io]'
      debug(`${tag} %O`, body)

      // Returns the query result rows as arrays rather than objects.
      const results = await performRawQuery(this.client, body)

      if (results.length !== 1) {
        throw new Error('Expected exactly one result')
      }

      const result = results[0]
      const { columns: columnNames = [], rows = [] } = result.results ?? {}
      const affectedRows = result.meta?.changes

      return { rows, columnNames, affectedRows }
    } catch (e) {
      onError(e as Error)
    }
  }
}

class D1HTTPTransaction extends D1HTTPQueryable implements Transaction {
  constructor(client: KyInstance, readonly options: TransactionOptions) {
    super(client)
  }

  async commit(): Promise<void> {
    debug(`[js::commit]`)
  }

  async rollback(): Promise<void> {
    debug(`[js::rollback]`)
  }
}

export class PrismaD1HTTPAdapter extends D1HTTPQueryable implements SqlDriverAdapter {
  readonly tags = {
    error: red('prisma:error'),
    warn: yellow('prisma:warn'),
    info: cyan('prisma:info'),
    query: blue('prisma:query'),
  }

  alreadyWarned = new Set()

  constructor(params: D1HTTPParams, private readonly release?: () => Promise<void>) {
    const D1_API_BASE_URL = `https://api.cloudflare.com/client/v4/accounts/${params.CLOUDFLARE_ACCOUNT_ID}/d1/database/${params.CLOUDFLARE_DATABASE_ID}`

    const client = ky.create({
      prefixUrl: D1_API_BASE_URL,
      headers: {
        Authorization: `Bearer ${params.CLOUDFLARE_D1_TOKEN}`,
      },
      // Don't automatically throw on non-2xx status codes
      throwHttpErrors: false,
    })

    super(client)
  }

  /**
   * This will warn once per transaction
   * e.g. the following two explicit transactions
   * will only trigger _two_ warnings
   *
   * ```ts
   * await prisma.$transaction([ ...queries ])
   * await prisma.$transaction([ ...moreQueries ])
   * ```
   */
  private warnOnce = (key: string, message: string, ...args: unknown[]) => {
    if (!this.alreadyWarned.has(key)) {
      this.alreadyWarned.add(key)
      console.info(`${this.tags.warn} ${message}`, ...args)
    }
  }

  async executeScript(script: string): Promise<void> {
    // Note: a more appropriate API to use would probably be the one described at
    // https://developers.cloudflare.com/api/resources/d1/subresources/database/methods/import.
    // However, it requires multi-step API invocations to retrieve a presigned R2 upload URL first,
    // (which is S3-compatible) and then upload the data to the URL.
    // Let's stick to the simpler API until we have valid use-cases for the more complex one.
    try {
      await performRawQuery(this.client, {
        json: {
          sql: script,
        },
      })
    } catch (error) {
      onError(error as Error)
    }
  }

  getConnectionInfo(): ConnectionInfo {
    return {
      maxBindValues: 98,
    }
  }

  async startTransaction(isolationLevel?: IsolationLevel): Promise<Transaction> {
    if (isolationLevel && isolationLevel !== 'SERIALIZABLE') {
      throw new DriverAdapterError({
        kind: 'InvalidIsolationLevel',
        level: isolationLevel,
      })
    }

    this.warnOnce(
      'D1 Transaction',
      "Cloudflare D1 does not support transactions yet. When using Prisma's D1 adapter, implicit & explicit transactions will be ignored and run as individual queries, which breaks the guarantees of the ACID properties of transactions. For more details see https://pris.ly/d/d1-transactions",
    )

    const options: TransactionOptions = {
      usePhantomQuery: true,
    }

    const tag = '[js::startTransaction]'
    debug('%s options: %O', tag, options)

    return new D1HTTPTransaction(this.client, options)
  }

  async dispose(): Promise<void> {
    await this.release?.()
  }
}

export class PrismaD1HTTPAdapterFactory implements SqlMigrationAwareDriverAdapterFactory {
  readonly provider = 'sqlite'
  readonly adapterName = `${packageName}-http`

  constructor(private params: D1HTTPParams) {}

  async connect(): Promise<SqlDriverAdapter> {
    return new PrismaD1HTTPAdapter(this.params, async () => {})
  }

  async connectToShadowDb(): Promise<SqlDriverAdapter> {
    const D1_API_BASE_URL = `https://api.cloudflare.com/client/v4/accounts/${this.params.CLOUDFLARE_ACCOUNT_ID}/d1/database`

    const client = ky.create({
      headers: {
        Authorization: `Bearer ${this.params.CLOUDFLARE_D1_TOKEN}`,
      },
      // Don't throw on non-2xx status codes
      throwHttpErrors: false,
    })

    const createShadowDatabase = async () => {
      const tag = '[js::connectToShadowDb::createShadowDatabase]'

      try {
        const CLOUDFLARE_SHADOW_DATABASE_NAME = `_shadow_${globalThis.crypto.randomUUID()}`
        debug(`${tag} creating database %s`, CLOUDFLARE_SHADOW_DATABASE_NAME)

        const response = (await client
          .post(D1_API_BASE_URL, {
            json: {
              name: CLOUDFLARE_SHADOW_DATABASE_NAME,
            },
          })
          .json()) as {
          errors: D1HTTPResponseInfo[]
          messages: D1HTTPResponseInfo[]
          result: { name: string; uuid: string }
          success?: true
        }

        debug(`${tag} %O`, response)

        if (!response.success) {
          throw new Error(response.errors[0].message, { cause: response.errors[0].code })
        }

        const { uuid: CLOUDFLARE_SHADOW_DATABASE_ID } = response.result
        debug(`${tag} created database %s with ID %s`, CLOUDFLARE_SHADOW_DATABASE_NAME, CLOUDFLARE_SHADOW_DATABASE_ID)

        return CLOUDFLARE_SHADOW_DATABASE_ID
      } catch (e) {
        onHTTPError(e as Error)
      }
    }

    const CLOUDFLARE_SHADOW_DATABASE_ID = this.params.CLOUDFLARE_SHADOW_DATABASE_ID ?? (await createShadowDatabase())

    const dispose = async () => {
      const tag = '[js::connectToShadowDb::dispose]'

      try {
        debug(`${tag} deleting database %s`, CLOUDFLARE_SHADOW_DATABASE_ID)

        const response = (await client.delete(`${D1_API_BASE_URL}/${CLOUDFLARE_SHADOW_DATABASE_ID}`).json()) as {
          errors: D1HTTPResponseInfo[]
          messages: D1HTTPResponseInfo[]
          success?: true
        }

        debug(`${tag} %O`, response)

        if (!response.success) {
          throw new Error(response.messages[0].message, { cause: response.errors[0].code })
        }
      } catch (e) {
        onHTTPError(e as Error)
      }
    }

    return new PrismaD1HTTPAdapter(this.params, dispose)
  }
}
