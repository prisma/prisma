import { D1Database, D1Response } from '@cloudflare/workers-types'
import {
  Debug,
  DriverAdapter,
  err,
  ok,
  Query,
  Queryable,
  Result,
  ResultSet,
  Transaction,
  TransactionOptions,
} from '@prisma/driver-adapter-utils'
import { blue, cyan, red, yellow } from 'kleur/colors'

import { getColumnTypes, mapRow } from './conversion'

const debug = Debug('prisma:driver-adapter:d1')

type D1ResultsWithColumnNames = [string[], unknown[][]]
type PerformIOResult = D1ResultsWithColumnNames | D1Response
type StdClient = D1Database

class D1Queryable<ClientT extends StdClient> implements Queryable {
  readonly provider = 'sqlite'

  constructor(protected readonly client: ClientT) {}

  /**
   * Execute a query given as SQL, interpolating the given parameters.
   */
  async queryRaw(query: Query): Promise<Result<ResultSet>> {
    const tag = '[js::query_raw]'
    debug(`${tag} %O`, query)

    const ioResult = await this.performIO(query)

    return ioResult.map((data) => {
      const convertedData = this.convertData(data as D1ResultsWithColumnNames)
      return convertedData
    })
  }

  private convertData(ioResult: D1ResultsWithColumnNames): ResultSet {
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
  async executeRaw(query: Query): Promise<Result<number>> {
    const tag = '[js::execute_raw]'
    debug(`${tag} %O`, query)

    const res = await this.performIO(query, true)
    return res.map((result) => (result as D1Response).meta.rows_written ?? 0)
  }

  private async performIO(query: Query, executeRaw = false): Promise<Result<PerformIOResult>> {
    try {
      query.args = query.args.map((arg) => this.cleanArg(arg))

      const stmt = this.client.prepare(query.sql).bind(...query.args)

      if (executeRaw) {
        return ok(await stmt.run())
      } else {
        const [columnNames, ...rows] = await stmt.raw({ columnNames: true })
        return ok([columnNames, rows])
      }
    } catch (e) {
      console.error('Error in performIO: %O', e)
      const { message } = e

      // We only get the error message, not the error code.
      // "name":"Error","message":"D1_ERROR: UNIQUE constraint failed: User.email"
      // So we try to match some errors and use the generic error code as a fallback.
      // https://www.sqlite.org/rescode.html
      // 1 = The SQLITE_ERROR result code is a generic error code that is used when no other more specific error code is available.
      // See quaint https://github.com/prisma/prisma-engines/blob/main/quaint/src/connector/sqlite/error.rs
      // some errors are matched by the extended code and others by the message there.
      let extendedCode = 1
      if (message.startsWith('D1_ERROR: UNIQUE constraint failed:')) {
        extendedCode = 2067
      } else if (message.startsWith('D1_ERROR: FOREIGN KEY constraint failed')) {
        extendedCode = 787
      } else if (message.startsWith('D1_ERROR: NOT NULL constraint failed')) {
        extendedCode = 1299
      }
      // These below were added based on
      // https://github.com/prisma/prisma-engines/blob/main/quaint/src/connector/sqlite/error.rs
      // https://github.com/prisma/prisma-engines/blob/main/quaint/src/connector/sqlite/ffi.rs
      else if (message.startsWith('D1_ERROR: CHECK constraint failed')) {
        extendedCode = 1811
      } else if (message.startsWith('D1_ERROR: PRIMARY KEY constraint failed')) {
        extendedCode = 1555
      }

      return err({
        kind: 'Sqlite',
        extendedCode,
        message,
      })
    }
  }

  cleanArg(arg: unknown): unknown {
    // * Hack for booleans, we must convert them to 0/1.
    // * ✘ [ERROR] Error in performIO: Error: D1_TYPE_ERROR: Type 'boolean' not supported for value 'true'
    if (arg === true) {
      return 1
    }

    if (arg === false) {
      return 0
    }

    if (arg instanceof Uint8Array) {
      return Array.from(arg)
    }

    if (typeof arg === 'bigint') {
      return String(arg)
    }

    return arg
  }
}

class D1Transaction extends D1Queryable<StdClient> implements Transaction {
  constructor(client: StdClient, readonly options: TransactionOptions) {
    super(client)
  }

  // eslint-disable-next-line @typescript-eslint/require-await
  async commit(): Promise<Result<void>> {
    debug(`[js::commit]`)

    return ok(undefined)
  }

  // eslint-disable-next-line @typescript-eslint/require-await
  async rollback(): Promise<Result<void>> {
    debug(`[js::rollback]`)

    return ok(undefined)
  }
}

export class PrismaD1 extends D1Queryable<StdClient> implements DriverAdapter {
  readonly tags = {
    error: red('prisma:error'),
    warn: yellow('prisma:warn'),
    info: cyan('prisma:info'),
    query: blue('prisma:query'),
  }

  alreadyWarned = new Set()

  constructor(client: StdClient) {
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
  warnOnce = (key: string, message: string, ...args: unknown[]) => {
    if (!this.alreadyWarned.has(key)) {
      this.alreadyWarned.add(key)
      console.info(`${this.tags.warn} ${message}`, ...args)
    }
  }

  // eslint-disable-next-line @typescript-eslint/require-await
  async startTransaction(): Promise<Result<Transaction>> {
    const options: TransactionOptions = {
      // TODO: D1 does not support transactions.
      usePhantomQuery: true,
    }

    const tag = '[js::startTransaction]'
    debug(`${tag} options: %O`, options)

    this.warnOnce(
      'D1 Transaction',
      "Cloudflare D1 - currently in Beta - does not support transactions. When using Prisma's D1 adapter, implicit & explicit transactions will be ignored and ran as individual queries, which breaks the guarantees of the ACID properties of transactions. For more details see https://pris.ly/d/d1-transactions",
    )

    return ok(new D1Transaction(this.client, options))
  }
}
