import {
  ConnectionInfo,
  Debug,
  DriverAdapterError,
  IsolationLevel,
  SqlDriverAdapter,
  SqlDriverAdapterFactory,
  SqlQuery,
  SqlQueryable,
  SqlResultSet,
  Transaction,
  TransactionOptions,
} from '@prisma/driver-adapter-utils'
import { Mutex } from 'async-mutex'
import sql from 'mssql'

import { name as packageName } from '../package.json'
import { mapArg, mapColumnType, mapIsolationLevel, mapRow } from './conversion'
import { convertDriverError } from './errors'

const debug = Debug('prisma:driver-adapter:mssql')

class MssqlQueryable implements SqlQueryable {
  readonly provider = 'sqlserver'
  readonly adapterName = packageName

  constructor(private conn: sql.ConnectionPool | sql.Transaction) {}

  async queryRaw(query: SqlQuery): Promise<SqlResultSet> {
    const tag = '[js::query_raw]'
    debug(`${tag} %O`, query)

    const { recordset, columns: columnsList } = await this.performIO(query)
    const columns = columnsList?.[0]
    return {
      columnNames: columns?.map((col) => col.name) ?? [],
      columnTypes: columns?.map(mapColumnType) ?? [],
      rows: recordset?.map((row) => mapRow(row, columns)) ?? [],
    }
  }

  async executeRaw(query: SqlQuery): Promise<number> {
    const tag = '[js::execute_raw]'
    debug(`${tag} %O`, query)

    return (await this.performIO(query)).rowsAffected?.[0] ?? 0
  }

  protected async performIO(query: SqlQuery): Promise<ArrayModeResult> {
    try {
      const req = this.conn.request()
      req.arrayRowMode = true

      for (let i = 0; i < query.args.length; i++) {
        req.input(`P${i + 1}`, mapArg(query.args[i]))
      }
      const res = (await req.query(query.sql)) as unknown as ArrayModeResult
      return res
    } catch (e) {
      this.onError(e)
    }
  }

  protected onError(error: any): never {
    debug('Error in performIO: %O', error)
    throw new DriverAdapterError(convertDriverError(error))
  }
}

class MssqlTransaction extends MssqlQueryable implements Transaction {
  #mutex = new Mutex()

  constructor(private transaction: sql.Transaction, readonly options: TransactionOptions) {
    super(transaction)
  }

  async performIO(query: SqlQuery): Promise<ArrayModeResult> {
    const release = await this.#mutex.acquire()
    try {
      return await super.performIO(query)
    } catch (e) {
      this.onError(e)
    } finally {
      release()
    }
  }

  async commit(): Promise<void> {
    debug(`[js::commit]`)

    await this.transaction.commit()
  }

  async rollback(): Promise<void> {
    debug(`[js::rollback]`)

    await this.transaction.rollback().catch((e) => {
      if (e.code === 'EABORT') {
        debug(`[js::rollback] Transaction already aborted`)
        return
      }

      throw e
    })
  }
}

export type PrismaMssqlOptions = {
  schema?: string
}

class PrismaMssqlAdapter extends MssqlQueryable implements SqlDriverAdapter {
  constructor(private pool: sql.ConnectionPool, private readonly options?: PrismaMssqlOptions) {
    super(pool)
  }

  executeScript(_script: string): Promise<void> {
    throw new Error('Method not implemented.')
  }

  async startTransaction(isolationLevel?: IsolationLevel): Promise<Transaction> {
    const options: TransactionOptions = {
      usePhantomQuery: true,
    }

    const tag = '[js::startTransaction]'
    debug('%s options: %O', tag, options)

    const tx = this.pool.transaction()
    try {
      await tx.begin(isolationLevel !== undefined ? mapIsolationLevel(isolationLevel) : undefined)
      return new MssqlTransaction(tx, options)
    } catch (e) {
      this.onError(e)
    }
  }

  getConnectionInfo?(): ConnectionInfo {
    return {
      maxBindValues: 2098,
      schemaName: this.options?.schema,
      supportsRelationJoins: false,
    }
  }

  async dispose(): Promise<void> {
    await this.pool.close()
  }

  underlyingDriver(): sql.ConnectionPool {
    return this.pool
  }
}

export class PrismaMssqlAdapterFactory implements SqlDriverAdapterFactory {
  readonly provider = 'sqlserver'
  readonly adapterName = packageName

  constructor(private readonly config: sql.config, private readonly options?: PrismaMssqlOptions) {}

  async connect(): Promise<PrismaMssqlAdapter> {
    const pool = new sql.ConnectionPool(this.config)
    await pool.connect()
    return new PrismaMssqlAdapter(pool, this.options)
  }
}

type ArrayModeResult = {
  recordset?: unknown[][]
  rowsAffected?: number[]
  columns?: sql.columns[]
}
