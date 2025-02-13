/* eslint-disable @typescript-eslint/require-await */

import type { D1Database, D1Response } from '@cloudflare/workers-types'
import {
  ConnectionInfo,
  Debug,
  DriverAdapter,
  err,
  ok,
  Query,
  Queryable,
  Result,
  ResultSet,
  Transaction,
  TransactionContext,
  TransactionOptions,
} from '@prisma/driver-adapter-utils'
import { blue, cyan, red, yellow } from 'kleur/colors'

import { name as packageName } from '../package.json'
import { getColumnTypes, mapRow } from './conversion'
import { cleanArg, matchSQLiteErrorCode } from './utils'

const debug = Debug('prisma:driver-adapter:d1')

type D1ResultsWithColumnNames = [string[], unknown[][]]
type PerformIOResult = D1ResultsWithColumnNames | D1Response
type StdClient = D1Database

class D1Queryable<ClientT extends StdClient> implements Queryable {
  readonly provider = 'sqlite'
  readonly adapterName = packageName

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
    return res.map((result) => (result as D1Response).meta.changes ?? 0)
  }

  private async performIO(query: Query, executeRaw = false): Promise<Result<PerformIOResult>> {
    try {
      query.args = query.args.map((arg, i) => cleanArg(arg, query.argTypes[i]))

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

      return err({
        kind: 'sqlite',
        extendedCode: matchSQLiteErrorCode(message),
        message,
      })
    }
  }
}

class D1Transaction extends D1Queryable<StdClient> implements Transaction {
  constructor(client: StdClient, readonly options: TransactionOptions) {
    super(client)
  }

  async commit(): Promise<Result<void>> {
    debug(`[js::commit]`)

    return ok(undefined)
  }

  async rollback(): Promise<Result<void>> {
    debug(`[js::rollback]`)

    return ok(undefined)
  }
}

class D1TransactionContext extends D1Queryable<StdClient> implements TransactionContext {
  constructor(readonly client: StdClient) {
    super(client)
  }

  async startTransaction(): Promise<Result<Transaction>> {
    const options: TransactionOptions = {
      // TODO: D1 does not have a Transaction API.
      usePhantomQuery: true,
    }

    const tag = '[js::startTransaction]'
    debug('%s options: %O', tag, options)

    return ok(new D1Transaction(this.client, options))
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
  private warnOnce = (key: string, message: string, ...args: unknown[]) => {
    if (!this.alreadyWarned.has(key)) {
      this.alreadyWarned.add(key)
      console.info(`${this.tags.warn} ${message}`, ...args)
    }
  }

  getConnectionInfo(): Result<ConnectionInfo> {
    return ok({
      maxBindValues: 98,
    })
  }

  async transactionContext(): Promise<Result<TransactionContext>> {
    this.warnOnce(
      'D1 Transaction',
      "Cloudflare D1 does not support transactions yet. When using Prisma's D1 adapter, implicit & explicit transactions will be ignored and run as individual queries, which breaks the guarantees of the ACID properties of transactions. For more details see https://pris.ly/d/d1-transactions",
    )

    return ok(new D1TransactionContext(this.client))
  }
}
