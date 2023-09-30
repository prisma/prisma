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

  // testSuiteName: any

  constructor(protected readonly client: ClientT) { //, testSuiteName) {
    // this.testSuiteName = testSuiteName
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
  private lineNumbersUsedByFile: Map<string, Set<number>> = new Map();
  private async readExpectedResponse(filePath: string, searchString: string): Promise<string> {
    // console.log("readExpectedResponse", filePath, searchString)
    return new Promise<string>((resolve, reject) => {
      if (!existsSync(filePath)) {
        resolve('')
        return
      }

      // console.log("% open", filePath, this.lineNumbersUsedByFile)
      if (!this.lineNumbersUsedByFile.has(filePath)) {
        this.lineNumbersUsedByFile.set(filePath, new Set());
      }

      const fileStream = createReadStream(filePath)
      const rl = createInterface({
        input: fileStream,
      })

      let found = false
      let done = false
      let lineNumber = 0; 

      // read the lines
      rl.on('line', (line) => {
        lineNumber++
        
        // get linesReadCache
        const lineNumbersUsed = this.lineNumbersUsedByFile.get(filePath);

        if (lineNumbersUsed && !lineNumbersUsed.has(lineNumber)) { // Check if the line has already been found
          if(!done) {
            if (found) {
              rl.close()
              // mark line as used as well
              // console.log("# mark as used (as result)", lineNumber, searchString, line)
              lineNumbersUsed.add(lineNumber); // Add the found line number to the set
              resolve(line) // Resolve the promise with the found line
              done = true
            } else if (line.includes(searchString)) {
              found = true
              // mark line as used
              // console.log("# mark as used (as query)", lineNumber, searchString, line)
              lineNumbersUsed.add(lineNumber); // Add the found line number to the set
            }
          }
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

    // const testSuiteName = this.testSuiteName
    const testName = globalThis['testName']
    // console.log('!!!testSuiteName!!!', testSuiteName)
    // console.log('!!!testName!!!', testName)
    
    try {
      let recordingFileName = ''

      if (testName) {
        recordingFileName = path.resolve('recordings', `${testName.replace(/[\/:*?"<>|]/g, '_')}.recording`)
        // avoid ENAMETOLONG with terrible hack
        if(recordingFileName.length > 250)
          recordingFileName.replace("undefined", "u").replace("undefined", "u").replace("undefined", "u").replace("relationMode", "rM").replace("provider","p").replace("onUpdate", "oU").replace("onDelete", "oD")
      } else {
        throw Error('testName is undefined')
      }

      let result: any = ''
      //console.log({ recordings })

      if (process.env.RECORDINGS == 'read') {
        const resultString = await this.readExpectedResponse(recordingFileName, sql.trim())
        // console.log("found this result: ", resultString)
        result = JSON.parse(resultString)

        // Throw error if the result was marked as en exception
        if(result.__type == "exception") {
          throw new Error(result)
        }
      } else {
        
        // console.log("### query", sql, values)
        try {
          result = await this.client.query({ text: sql, values, rowMode: 'array' })
        } catch (error) {
          
          // console.log("### error", error)

          // mark error object as exception
          error.__type = "exception"
          // write error to file as usual
          await fsPromises.appendFile(recordingFileName, sql.trim() + '\n' + JSON.stringify(error) + '\n\n', { flag: 'a' })

          // then throw anyway of course
          throw error
        }
        
        console.log("### result", result)

        if (process.env.RECORDINGS == 'write') {
          await fsPromises.appendFile(recordingFileName, sql.trim() + '\n' + JSON.stringify(result) + '\n\n', { flag: 'a' })
        }
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

  constructor(client: pg.PoolClient, /*testName,*/ readonly options: TransactionOptions) {
    super(client) //, testName)
  }

  // eslint-disable-next-line @typescript-eslint/require-await
  async commit(): Promise<Result<void>> {
    debug(`[js::commit]`)

    this.finished = true
    if(process.env.RECORDINGS != "read") this.client.release()
    return ok(undefined)
  }

  // eslint-disable-next-line @typescript-eslint/require-await
  async rollback(): Promise<Result<void>> {
    debug(`[js::rollback]`)

    this.finished = true
    if(process.env.RECORDINGS != "read") this.client.release()
    return ok(undefined)
  }

  dispose(): Result<void> {
    if (!this.finished) {
      if(process.env.RECORDINGS != "read") this.client.release()
    }
    return ok(undefined)
  }
}

export class PrismaPg extends PgQueryable<StdClient> implements DriverAdapter {
  constructor(client: pg.Pool) { //, testSuiteName) {
    super(client) //, testSuiteName)
  }

  async startTransaction(): Promise<Result<Transaction>> {
    const options: TransactionOptions = {
      usePhantomQuery: false,
    }

    const tag = '[js::startTransaction]'
    debug(`${tag} options: %O`, options)

    let connection: any = undefined
    if(process.env.RECORDINGS != "read") connection = await this.client.connect()

    return ok(new PgTransaction(connection, options)) //this.testSuiteName, options))
  }

  // eslint-disable-next-line @typescript-eslint/require-await
  async close() {
    return ok(undefined)
  }
}
