import type {
  DriverAdapter,
  Query,
  Queryable,
  Result,
  ResultSet,
  Transaction,
  TransactionOptions,
} from '@prisma/driver-adapter-utils'
import { Debug, ok } from '@prisma/driver-adapter-utils'
import { createReadStream, existsSync, promises as fsPromises } from 'fs'
import path from 'path'
import type pg from 'pg'
import { createInterface } from 'readline'

import { fieldToColumnType } from './conversion'

const debug = Debug('prisma:driver-adapter:pg')

type StdClient = pg.Pool
type TransactionClient = pg.PoolClient

class PgQueryable<ClientT extends StdClient | TransactionClient> implements Queryable {
  readonly flavour = 'postgres'

  testName: any

  constructor(protected readonly client: ClientT, testName) {
    this.testName = testName
  }

  /**
   * Execute a query given as SQL, interpolating the given parameters.
   */
  async queryRaw(query: Query): Promise<Result<ResultSet>> {
    const tag = '[js::query_raw]'
    debug(`${tag} %O`, query)

    const { fields, rows } = await this.performIO(query)

    const columns = fields.map((field) => field.name)
    const columnTypes = fields.map((field) => fieldToColumnType(field.dataTypeID))

    const resultSet: ResultSet = {
      columnNames: columns,
      columnTypes,
      rows,
    }

    return ok(resultSet)
  }

  /**
   * Execute a query given as SQL, interpolating the given parameters and
   * returning the number of affected rows.
   * Note: Queryable expects a u64, but napi.rs only supports u32.
   */
  async executeRaw(query: Query): Promise<Result<number>> {
    const tag = '[js::execute_raw]'
    debug(`${tag} %O`, query)

    const { rowCount: rowsAffected } = await this.performIO(query)

    // Note: `rowsAffected` can sometimes be null (e.g., when executing `"BEGIN"`)
    return ok(rowsAffected ?? 0)
  }

  // Worst code ever :shrug: Thanks ChatGPT though!
  private async readExpectedResponse(filePath: string, searchString: string): Promise<string> {
    return new Promise<string>((resolve, reject) => {
      if (!existsSync(filePath)) {
        resolve('')
        return
      }

      const fileStream = createReadStream(filePath)
      const rl = createInterface({
        input: fileStream,
      })

      let found = false

      rl.on('line', (line) => {
        if (found) {
          rl.close()
          resolve(line) // Resolve the promise with the found line
        } else if (line.includes(searchString)) {
          found = true
        }
      })

      rl.on('close', () => {
        if (!found) {
          console.log('Search string not found in the file.')
          reject(new Error(`Search string not found: ${searchString}, (${filePath})`))
        }
      })
    })
  }

  /**
   * Run a query against the database, returning the result set.
   * Should the query fail due to a connection error, the connection is
   * marked as unhealthy.
   */
  private async performIO(query: Query) {
    const { sql, args: values } = query

    // console.log("!!!!!!!!!!!!!!!!!!!!!!", this.testName)
    try {
      let recordingFileName = ''
      if (this.testName) {
        recordingFileName = path.resolve('recordings', `${this.testName.replace(/[\/:*?"<>|]/g, '_')}.recording`)
      } else {
        throw Error('this.testName is undefined')
      }

      let result: any = ''

      const recordings = process.env.RECORDINGS
      //console.log({ recordings })

      if (recordings == 'read') {
        const resultString = await this.readExpectedResponse(recordingFileName, sql)
        // console.log("found this result: ", resultString)
        result = JSON.parse(resultString)
      } else if (recordings == 'write') {
        result = await this.client.query({ text: sql, values, rowMode: 'array' })

        await fsPromises.appendFile(recordingFileName, sql + '\n' + JSON.stringify(result) + '\n\n', { flag: 'a' })
      }

      return result
    } catch (e) {
      const error = e as Error
      debug('Error in performIO: %O', error)
      throw error
    }
  }
}

class PgTransaction extends PgQueryable<TransactionClient> implements Transaction {
  finished = false

  constructor(client: pg.PoolClient, readonly options: TransactionOptions) {
    super(client)
  }

  // eslint-disable-next-line @typescript-eslint/require-await
  async commit(): Promise<Result<void>> {
    debug(`[js::commit]`)

    this.finished = true
    this.client.release()
    return ok(undefined)
  }

  // eslint-disable-next-line @typescript-eslint/require-await
  async rollback(): Promise<Result<void>> {
    debug(`[js::rollback]`)

    this.finished = true
    this.client.release()
    return ok(undefined)
  }

  dispose(): Result<void> {
    if (!this.finished) {
      this.client.release()
    }
    return ok(undefined)
  }
}

export class PrismaPg extends PgQueryable<StdClient> implements DriverAdapter {
  constructor(client: pg.Pool, testName) {
    super(client, testName)
  }

  async startTransaction(): Promise<Result<Transaction>> {
    const options: TransactionOptions = {
      usePhantomQuery: false,
    }

    const tag = '[js::startTransaction]'
    debug(`${tag} options: %O`, options)

    const connection = await this.client.connect()
    return ok(new PgTransaction(connection, options))
  }

  // eslint-disable-next-line @typescript-eslint/require-await
  async close() {
    return ok(undefined)
  }
}
