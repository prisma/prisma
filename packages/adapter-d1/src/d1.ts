import { D1Database, D1Result } from '@cloudflare/workers-types'
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
import { Mutex } from 'async-mutex'

const debug = Debug('prisma:driver-adapter:d1')

type PerformIOResult = D1Result
// type ExecIOResult = D1ExecResult

type StdClient = D1Database

const LOCK_TAG = Symbol()

class D1Queryable<ClientT extends StdClient> implements Queryable {
  readonly provider = 'sqlite';

  [LOCK_TAG] = new Mutex()

  constructor(protected readonly client: ClientT) {}

  /**
   * Execute a query given as SQL, interpolating the given parameters.
   */
  async queryRaw(query: Query): Promise<Result<ResultSet>> {
    // env.name.query
    const tag = '[js::query_raw]'
    debug(`${tag} %O`, query)

    const ioResult = await this.performIO(query)

    return ioResult.map((_) => {
      return {
        columnNames: [],
        columnTypes: [],
        rows: [],
      }
    })
  }

  /**
   * Execute a query given as SQL, interpolating the given parameters and
   * returning the number of affected rows.
   * Note: Queryable expects a u64, but napi.rs only supports u32.
   */
  async executeRaw(query: Query): Promise<Result<number>> {
    const tag = '[js::execute_raw]'
    debug(`${tag} %O`, query)

    // ?(@druue) Unsure if `results.length` is what we actually want here. There is no direct count prop; there are `rows_read`, `rows_written`, and `changes` properties inside the meta prop.
    return (await this.performIO(query)).map(({ meta }) => meta.changes ?? 0)
  }

  private async performIO(query: Query): Promise<Result<PerformIOResult>> {
    const release = await this[LOCK_TAG].acquire()

    try {
      const result = await this.client.prepare(query.sql).bind(query.args).run()
      return ok(result)
    } catch (e) {
      const error = e as Error
      debug('Error in performIO: %O', error)

      const rawCode = error['rawCode'] ?? e.cause?.['rawCode']
      if (typeof rawCode === 'number') {
        return err({
          kind: 'Sqlite',
          extendedCode: rawCode,
          message: error.message,
        })
      }
      throw error
    } finally {
      release()
    }
  }
}

export class PrismaD1 extends D1Queryable<StdClient> implements DriverAdapter {
  constructor(client: StdClient) {
    super(client)
  }

  startTransaction(): Promise<Result<Transaction>> {
    const options: TransactionOptions = {
      usePhantomQuery: false,
    }

    const tag = '[js::startTransaction]'
    debug(`${tag} options: %O`, options)

    // try {
    //   const tx = await this.client.batch
    // }

    throw new Error('D1 only supports transactions in the form of batches.')
  }
}
