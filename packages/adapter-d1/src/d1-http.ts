/* eslint-disable @typescript-eslint/require-await */

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
import { GENERIC_SQLITE_ERROR, MAX_BIND_VALUES } from './constants'
import { getColumnTypes, mapRow } from './conversion'
import { convertDriverError } from './errors'
import { cleanArg } from './utils'

const debug = Debug('prisma:driver-adapter:d1-http')

type D1HTTPResponseInfo = {
  code: number // >= 1000
  message: string
}

type D1HTTPRawResult = {
  meta?: Partial<{
    changes: number
  }>
  results?: {
    columns?: string[]
    rows?: unknown[][]
  }
  success?: boolean
}

function onUnsuccessfulD1HTTPResponse({ errors }: { errors: D1HTTPResponseInfo[] }): never {
  debug('D1 HTTP Errors: %O', errors)
  const error = errors.at(0) ?? { message: 'Unknown error', code: GENERIC_SQLITE_ERROR }
  throw new DriverAdapterError(convertDriverError(error))
}

function onGenericD1HTTPError(error: Error): never {
  debug('HTTP Error: %O', error)
  throw new DriverAdapterError(convertDriverError(error))
}

function onError(error: Error): never {
  console.error('Error in performIO: %O', error)
  throw new DriverAdapterError(convertDriverError(error))
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
      onUnsuccessfulD1HTTPResponse(response)
    }

    return response.result
  } catch (e) {
    onGenericD1HTTPError(e as Error)
  }
}

type D1HTTPParams = {
  CLOUDFLARE_D1_TOKEN: string
  CLOUDFLARE_ACCOUNT_ID: string
  CLOUDFLARE_DATABASE_ID: string
  CLOUDFLARE_SHADOW_DATABASE_ID?: string
}

/**
 * HTTP-based Cloudflare D1 adapter.
 */
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
      maxBindValues: MAX_BIND_VALUES,
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
      const SHADOW_DATABASE_PREFIX = '_prisma_shadow_'
      const CLOUDFLARE_SHADOW_DATABASE_NAME = `${SHADOW_DATABASE_PREFIX}${globalThis.crypto.randomUUID()}`
      debug(`${tag} creating database %s`, CLOUDFLARE_SHADOW_DATABASE_NAME)

      try {
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
          onUnsuccessfulD1HTTPResponse(response)
        }

        const { uuid: CLOUDFLARE_SHADOW_DATABASE_ID } = response.result
        debug(`${tag} created database %s with ID %s`, CLOUDFLARE_SHADOW_DATABASE_NAME, CLOUDFLARE_SHADOW_DATABASE_ID)

        return CLOUDFLARE_SHADOW_DATABASE_ID
      } catch (e) {
        onGenericD1HTTPError(e as Error)
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
          onUnsuccessfulD1HTTPResponse(response)
        }
      } catch (e) {
        onGenericD1HTTPError(e as Error)
      }
    }

    return new PrismaD1HTTPAdapter(this.params, dispose)
  }
}
