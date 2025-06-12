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
import * as sql from 'mssql'

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

    const { recordset, columns } = await this.performIO(query)
    return {
      columnNames: columns?.[0]?.map((col) => col.name) ?? [],
      columnTypes: columns?.[0]?.map(mapColumnType) ?? [],
      rows: recordset?.map(mapRow) ?? [],
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

const LOCK_TAG = Symbol()

class MssqlTransaction extends MssqlQueryable implements Transaction {
  [LOCK_TAG] = new Mutex()

  constructor(private transaction: sql.Transaction, readonly options: TransactionOptions) {
    super(transaction)
  }

  async performIO(query: SqlQuery): Promise<ArrayModeResult> {
    const release = await this[LOCK_TAG].acquire()
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

    await this.transaction.rollback()
  }
}

class PrismaMssqlAdapter extends MssqlQueryable implements SqlDriverAdapter {
  constructor(private pool: sql.ConnectionPool) {
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
      supportsRelationJoins: false,
    }
  }

  async dispose(): Promise<void> {
    await this.pool.close()
  }
}

export class PrismaMssqlAdapterFactory implements SqlDriverAdapterFactory {
  readonly provider = 'sqlserver'
  readonly adapterName = packageName

  constructor(private readonly config: sql.config) {}

  async connect(): Promise<SqlDriverAdapter> {
    const pool = await sql.connect(this.config)
    return new PrismaMssqlAdapter(pool)
  }
}

type ArrayModeResult = {
  recordset?: unknown[][]
  rowsAffected?: number[]
  columns?: sql.columns[]
}
