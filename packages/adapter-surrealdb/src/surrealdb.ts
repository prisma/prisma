/* eslint-disable @typescript-eslint/require-await */

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

export type PrismaSurrealDbOptions = {
  namespace?: string
  database?: string
}

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

    // Build a bindings object from positional params: $1, $2, ... -> { '1': value, '2': value }
    const bindings: Record<string, unknown> = {}
    for (let i = 0; i < mappedArgs.length; i++) {
      bindings[String(i + 1)] = mappedArgs[i]
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

export class PrismaSurrealDbAdapter extends SurrealDbQueryable implements SqlDriverAdapter {
  constructor(
    client: Surreal,
    private readonly options?: PrismaSurrealDbOptions,
    private readonly release?: () => Promise<void>,
  ) {
    super(client)
  }

  async startTransaction(_isolationLevel?: IsolationLevel): Promise<Transaction> {
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
      schemaName: this.options?.namespace,
      supportsRelationJoins: false,
    }
  }

  async dispose(): Promise<void> {
    return this.release?.()
  }
}

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
      return new PrismaSurrealDbAdapter(this.#externalClient, this.#options, async () => {
        // Do not close externally provided clients
      })
    }

    const client = new Surreal()
    await client.connect(this.#url)

    if (this.#options?.namespace || this.#options?.database) {
      await client.use({
        namespace: this.#options.namespace,
        database: this.#options.database,
      })
    }

    return new PrismaSurrealDbAdapter(client, this.#options, async () => {
      await client.close()
    })
  }
}
