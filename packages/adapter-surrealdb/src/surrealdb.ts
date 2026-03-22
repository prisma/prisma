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
import Surreal from 'surrealdb'

import { name as packageName } from '../package.json'
import { inferColumnType, mapArg, objectToRow } from './conversion'
import { convertDriverError } from './errors'

const debug = Debug('prisma:driver-adapter:surrealdb')

/** Options for configuring the SurrealDB adapter connection. */
export interface PrismaSurrealDbOptions {
  /** SurrealDB namespace to use. */
  namespace?: string
  /** SurrealDB database to use within the namespace. */
  database?: string
}

/** Base queryable class wrapping a SurrealDB client for executing queries. */
class SurrealDbQueryable implements SqlQueryable {
  readonly provider = 'surrealdb' as const
  readonly adapterName = packageName

  constructor(protected readonly client: Surreal) {}

  async queryRaw(query: SqlQuery): Promise<SqlResultSet> {
    const tag = '[js::query_raw]'
    debug(`${tag} %O`, query)

    const results = await this.performIO(query)

    if (!Array.isArray(results) || results.length === 0) {
      return { columnNames: [], columnTypes: [], rows: [] }
    }

    // SurrealDB returns an array of results (one per statement).
    // We take the last result set, which corresponds to the main query.
    const resultSet = Array.isArray(results[results.length - 1]) ? results[results.length - 1] : results

    if (!Array.isArray(resultSet) || resultSet.length === 0) {
      return { columnNames: [], columnTypes: [], rows: [] }
    }

    const firstRow = resultSet[0]
    if (typeof firstRow !== 'object' || firstRow === null) {
      return { columnNames: [], columnTypes: [], rows: [] }
    }

    const columnNames = Object.keys(firstRow as Record<string, unknown>)
    const columnTypes: ColumnType[] = columnNames.map((name) =>
      inferColumnType((firstRow as Record<string, unknown>)[name]),
    )

    const rows = resultSet.map((row: unknown) => objectToRow(row as Record<string, unknown>, columnNames))

    return { columnNames, columnTypes, rows }
  }

  async executeRaw(query: SqlQuery): Promise<number> {
    const tag = '[js::execute_raw]'
    debug(`${tag} %O`, query)

    const results = await this.performIO(query)

    // For mutations, SurrealDB returns the affected records.
    if (Array.isArray(results)) {
      const lastResult = results[results.length - 1]
      if (Array.isArray(lastResult)) {
        return lastResult.length
      }
      return results.length
    }

    return 0
  }

  private async performIO(query: SqlQuery): Promise<unknown> {
    const { sql, args, argTypes } = query
    const mappedArgs = args.map((arg, i) => mapArg(arg, argTypes[i]))

    // SurrealDB parameters must start with a letter. The query compiler generates
    // placeholders as $p1, $p2 etc., and we bind them here using matching keys.
    const bindings: Record<string, unknown> = {}
    for (let i = 0; i < mappedArgs.length; i++) {
      bindings[`p${i + 1}`] = mappedArgs[i]
    }

    try {
      return await this.client.query(sql, bindings)
    } catch (e) {
      this.onError(e)
    }
  }

  protected onError(error: unknown): never {
    debug('Error in performIO: %O', error)
    throw new DriverAdapterError(convertDriverError(error))
  }
}

/** Transaction wrapper for SurrealDB using BEGIN/COMMIT/CANCEL TRANSACTION. */
class SurrealDbTransaction extends SurrealDbQueryable implements Transaction {
  constructor(
    client: Surreal,
    readonly options: TransactionOptions,
  ) {
    super(client)
  }

  async commit(): Promise<void> {
    debug('[js::commit]')
    try {
      await this.client.query('COMMIT TRANSACTION')
    } catch (e) {
      this.onError(e)
    }
  }

  async rollback(): Promise<void> {
    debug('[js::rollback]')
    try {
      await this.client.query('CANCEL TRANSACTION')
    } catch (e) {
      this.onError(e)
    }
  }

  // SurrealDB does not support savepoints
}

/** Prisma driver adapter for SurrealDB, implementing `SqlDriverAdapter`. */
export class PrismaSurrealDbAdapter extends SurrealDbQueryable implements SqlDriverAdapter {
  #options?: PrismaSurrealDbOptions
  #release?: () => Promise<void>

  constructor(
    client: Surreal,
    options?: PrismaSurrealDbOptions,
    release?: () => Promise<void>,
  ) {
    super(client)
    this.#options = options
    this.#release = release
  }

  async startTransaction(_isolationLevel?: IsolationLevel): Promise<Transaction> {
    // SurrealDB does not support configurable isolation levels.
    // All transactions use the database's default isolation semantics.
    const txOptions: TransactionOptions = {
      usePhantomQuery: false,
    }

    const tag = '[js::startTransaction]'
    debug('%s options: %O', tag, txOptions)

    try {
      await this.client.query('BEGIN TRANSACTION')
      return new SurrealDbTransaction(this.client, txOptions)
    } catch (error) {
      this.onError(error)
    }
  }

  async executeScript(script: string): Promise<void> {
    try {
      await this.client.query(script)
    } catch (error) {
      this.onError(error)
    }
  }

  getConnectionInfo(): ConnectionInfo {
    return {
      schemaName: this.#options?.namespace,
      supportsRelationJoins: false,
    }
  }

  /* eslint-disable-next-line @typescript-eslint/require-await */
  async dispose(): Promise<void> {
    return this.#release?.()
  }
}

/** Factory for creating Prisma SurrealDB driver adapter instances. */
export class PrismaSurrealDbAdapterFactory implements SqlDriverAdapterFactory {
  readonly provider = 'surrealdb' as const
  readonly adapterName = packageName
  #url: string
  #options: PrismaSurrealDbOptions | undefined
  #externalClient: Surreal | null

  constructor(urlOrClient: Surreal | string, options?: PrismaSurrealDbOptions) {
    if (urlOrClient instanceof Surreal) {
      this.#externalClient = urlOrClient
      this.#url = ''
    } else {
      this.#externalClient = null
      this.#url = urlOrClient
    }
    this.#options = options
  }

  async connect(): Promise<PrismaSurrealDbAdapter> {
    if (this.#externalClient) {
      /* eslint-disable-next-line @typescript-eslint/require-await */
      return new PrismaSurrealDbAdapter(this.#externalClient, this.#options, async () => {
        // Do not close externally provided clients
      })
    }

    // Parse credentials from the URL (e.g. surrealdb://user:pass@host:port/ns/db)
    let connectUrl = this.#url
    let username: string | undefined
    let password: string | undefined

    try {
      // Replace surrealdb:// with http:// for URL parsing (URL class needs a known protocol)
      const parseable = this.#url.replace(/^surrealdb:\/\//, 'http://')
      const parsed = new URL(parseable)
      if (parsed.username) {
        username = decodeURIComponent(parsed.username)
        password = decodeURIComponent(parsed.password)
        parsed.username = ''
        parsed.password = ''
      }
      // Always normalize to ws:// for SurrealDB WebSocket connection
      connectUrl = parsed.toString().replace(/^http:\/\//, 'ws://')
    } catch {
      // If URL parsing fails, use the original URL as-is
    }

    const client = new Surreal()
    try {
      await client.connect(connectUrl)

      if (username) {
        await client.signin({ username, password: password ?? '' })
      }

      if (this.#options?.namespace || this.#options?.database) {
        await client.use({
          namespace: this.#options.namespace,
          database: this.#options.database,
        })
      }
    } catch (error) {
      await client.close()
      throw error
    }

    return new PrismaSurrealDbAdapter(client, this.#options, async () => {
      await client.close()
    })
  }
}
