/* eslint-disable @typescript-eslint/require-await */

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

import { name as packageName } from '../package.json'
import { getColumnTypes, mapArg, mapRow } from './conversion'
import { convertDriverError } from './errors'

const debug = Debug('prisma:driver-adapter:bun-postgres')

type BunSqlRow = Record<string, unknown>

type BunSqlQueryResult = BunSqlRow[] & {
  count?: number | null
  command?: string
  lastInsertRowid?: number | null
  affectedRows?: number | null
}

interface BunReservedSqlClient {
  unsafe(sql: string, values?: unknown[]): Promise<BunSqlQueryResult>
  close(): Promise<void>
  release(): void | Promise<void>
}

interface BunSqlClient extends BunReservedSqlClient {
  reserve(): Promise<BunReservedSqlClient>
}

type BunSqlConstructor = new (
  connectionString: string | URL,
  options?: {
    bigint?: boolean
  },
) => BunSqlClient

type BunModule = {
  SQL: BunSqlConstructor
}

type BunSqlClientFactory = (connectionString: string | URL) => Promise<BunSqlClient>

type PrismaBunPostgresOptions = {
  schema?: string
}

class BunPostgresQueryable<ClientT extends BunSqlClient | BunReservedSqlClient> implements SqlQueryable {
  readonly provider = 'postgres'
  readonly adapterName = packageName

  constructor(protected readonly client: ClientT) {}

  async queryRaw(query: SqlQuery): Promise<SqlResultSet> {
    const tag = '[js::query_raw]'
    debug(`${tag} %O`, query)

    const result = await this.performIO(query)
    const rowObjects = Array.from(result)

    const columnNames = rowObjects[0] ? Object.keys(rowObjects[0]) : []
    const rows = rowObjects.map((row) => columnNames.map((columnName) => row[columnName] ?? null))
    const columnTypes = getColumnTypes(columnNames, rows)

    return {
      columnNames,
      columnTypes,
      rows: rows.map((row) => mapRow(row, columnTypes)),
    }
  }

  async executeRaw(query: SqlQuery): Promise<number> {
    const tag = '[js::execute_raw]'
    debug(`${tag} %O`, query)

    const result = await this.performIO(query)

    if (typeof result.affectedRows === 'number') {
      return result.affectedRows
    }

    if (typeof result.count === 'number') {
      return result.count
    }

    return 0
  }

  protected async performIO(query: SqlQuery): Promise<BunSqlQueryResult> {
    const { sql, args } = query
    const values = args.map((arg, i) => mapArg(arg, query.argTypes[i]))

    try {
      return await this.client.unsafe(sql, values)
    } catch (error) {
      this.onError(error)
    }
  }

  protected onError(error: unknown): never {
    debug('Error in performIO: %O', error)
    throw new DriverAdapterError(convertDriverError(error))
  }
}

class BunPostgresTransaction extends BunPostgresQueryable<BunReservedSqlClient> implements Transaction {
  readonly #cleanup: () => Promise<void>

  constructor(
    client: BunReservedSqlClient,
    readonly options: TransactionOptions,
    cleanup: () => Promise<void>,
  ) {
    super(client)
    this.#cleanup = cleanup
  }

  async commit(): Promise<void> {
    debug('[js::commit]')
    await this.#cleanup()
  }

  async rollback(): Promise<void> {
    debug('[js::rollback]')
    await this.#cleanup()
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

export type PrismaBunPostgresConfig = {
  connectionString: string | URL
  schema?: string
}

export class PrismaBunPostgresAdapter extends BunPostgresQueryable<BunSqlClient> implements SqlDriverAdapter {
  readonly #options: PrismaBunPostgresOptions | undefined
  readonly #release: (() => Promise<void>) | undefined

  constructor(client: BunSqlClient, options?: PrismaBunPostgresOptions, release?: () => Promise<void>) {
    super(client)
    this.#options = options
    this.#release = release
  }

  async startTransaction(isolationLevel?: IsolationLevel): Promise<Transaction> {
    const options: TransactionOptions = {
      usePhantomQuery: false,
    }

    const tag = '[js::startTransaction]'
    debug('%s options: %O', tag, options)

    const connection = await this.client.reserve().catch((error) => this.onError(error))

    const cleanup = async () => {
      await connection.release()
    }

    try {
      const tx = new BunPostgresTransaction(connection, options, cleanup)
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
      await cleanup().catch(() => {})
      this.onError(error)
    }
  }

  async executeScript(script: string): Promise<void> {
    // This follows existing adapter behavior and intentionally keeps script execution simple.
    const statements = script
      .split(';')
      .map((statement) => statement.trim())
      .filter((statement) => statement.length > 0)

    for (const statement of statements) {
      try {
        await this.client.unsafe(statement)
      } catch (error) {
        this.onError(error)
      }
    }
  }

  getConnectionInfo(): ConnectionInfo {
    return {
      schemaName: this.#options?.schema,
      supportsRelationJoins: true,
    }
  }

  async dispose(): Promise<void> {
    await this.#release?.()
  }
}

export class PrismaBunPostgresAdapterFactory implements SqlMigrationAwareDriverAdapterFactory {
  readonly provider = 'postgres'
  readonly adapterName = packageName

  readonly #config: PrismaBunPostgresConfig
  readonly #createClient: BunSqlClientFactory

  constructor(config: PrismaBunPostgresConfig, createClient?: BunSqlClientFactory) {
    this.#config = config
    this.#createClient = createClient ?? ((connectionString) => createBunSqlClient(connectionString))
  }

  async connect(): Promise<PrismaBunPostgresAdapter> {
    const client = await this.#createClient(this.#config.connectionString)

    return new PrismaBunPostgresAdapter(client, { schema: this.#config.schema }, async () => {
      await client.close()
    })
  }

  async connectToShadowDb(): Promise<PrismaBunPostgresAdapter> {
    const adminAdapter = await this.connect()
    const database = `prisma_migrate_shadow_db_${globalThis.crypto.randomUUID()}`
    const quotedDatabase = quoteIdentifier(database)

    try {
      await adminAdapter.executeScript(`CREATE DATABASE ${quotedDatabase}`)
    } catch (error) {
      await adminAdapter.dispose().catch(() => {})
      throw error
    }

    const shadowConnectionString = withDatabaseName(this.#config.connectionString, database)
    const shadowClient = await this.#createClient(shadowConnectionString).catch(async (error) => {
      try {
        await adminAdapter.executeScript(`DROP DATABASE ${quotedDatabase}`)
      } finally {
        await adminAdapter.dispose().catch(() => {})
      }
      throw error
    })

    return new PrismaBunPostgresAdapter(shadowClient, undefined, async () => {
      try {
        await shadowClient.close()
      } finally {
        try {
          await adminAdapter.executeScript(`DROP DATABASE ${quotedDatabase}`)
        } finally {
          await adminAdapter.dispose()
        }
      }
    })
  }
}

async function createBunSqlClient(connectionString: string | URL): Promise<BunSqlClient> {
  assertBunRuntime()

  const bunModuleSpecifier: string = 'bun'
  const bunModule = (await import(bunModuleSpecifier)) as BunModule

  return new bunModule.SQL(connectionString, { bigint: true })
}

function assertBunRuntime() {
  const bunGlobal = (globalThis as { Bun?: { version?: string } }).Bun
  if (!bunGlobal || typeof bunGlobal.version !== 'string') {
    throw new Error(
      '`@prisma/adapter-bun-postgres` requires Bun runtime. Use `--runtime bun` for functional tests or use `@prisma/adapter-pg` in Node.js.',
    )
  }
}

function quoteIdentifier(value: string): string {
  return `"${value.replace(/"/g, '""')}"`
}

function withDatabaseName(connectionString: string | URL, databaseName: string): string {
  const url = new URL(connectionString.toString())
  url.pathname = `/${databaseName}`
  return url.toString()
}
