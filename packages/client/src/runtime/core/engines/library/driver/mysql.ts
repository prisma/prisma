/* eslint-disable */

import * as mysql from 'mysql2/promise'
import type { Driver, Closeable, ResultSet } from '../types/Library'

class PrismaMySQL implements Driver, Closeable {
  private pool: mysql.Pool
  private maybeVersion?: string
  private isRunning: boolean = true

  constructor(connectionString: string) {
    console.log(`[nodejs] initializing mysql connection pool: ${connectionString}`)
    this.pool = mysql.createPool(connectionString)

    // lazily retrieve the version and store it into `maybeVersion`
    this.pool.query<mysql.RowDataPacket[]>({
      sql: 'SELECT @@version, @@GLOBAL.version',
    }).then(([results, _]) => {
      this.maybeVersion = results[0]['@@version']
    })
  }

  async close(): Promise<void> {
    console.log('[nodejs] calling close() on connection pool')
    if (this.isRunning) {
      this.isRunning = false
      await this.pool.end()
      console.log('[nodejs] closed connection pool')
    }
  }

  /**
   * Returns false, if connection is considered to not be in a working state.
   */
  isHealthy(): boolean {
    const result = this.maybeVersion !== undefined
      && this.isRunning
    console.log(`[nodejs] isHealthy: ${result}`)
    return result
  }

  /**
   * Execute a query given as SQL, interpolating the given parameters.
   */
  async queryRaw(query: string): Promise<ResultSet> {
    console.log('[nodejs] calling queryRaw', query)
    const [results, fields] = await this.pool.query<mysql.RowDataPacket[]>({
      sql: query,
      rowsAsArray: false,
    })
    console.log('[nodejs] after query')

    const columns = fields.map(field => field.name)
    const resultSet: ResultSet = {
      columns: columns,

      // TODO: what if I remove the `toString()`?
      // Currently, it would fail with something like:
      // [Error: Failed to convert JavaScript value `Number 1 ` into rust type `String`],
      // because the `id` column is a number, but the `ResultSet` expects a Vec<Vec<Str>>.
      rows: results.map(result => columns.map(column => result[column].toString()))
    };
    console.log('[nodejs] resultSet', resultSet)

    /*
    resultSet {
      columns: [ 'id', 'firstname', 'company_id' ],
      rows: [ [ 1, 'Alberto', 1 ], [ 2, 'Tom', 1 ] ]
    }
    */

    return resultSet
  }

  /**
   * Execute a query given as SQL, interpolating the given parameters and
   * returning the number of affected rows.
   * Note: Queryable expects a u64, but napi.rs only supports u32.
   */
  async executeRaw(query: string): Promise<number> {
    console.log('[nodejs] calling executeRaw', query)
    const [{ affectedRows }, _] = await this.pool.execute<mysql.ResultSetHeader>({
      sql: query,
    })
    return affectedRows
  }

  /**
   * Return the version of the underlying database, queried directly from the
   * source. This corresponds to the `version()` function on PostgreSQL for
   * example. The version string is returned directly without any form of
   * parsing or normalization.
   */
  version(): Promise<string | undefined> {
    return Promise.resolve(this.maybeVersion)
  }
}

export const createMySQLDriver = (connectionString: string): Driver & Closeable => {
  const db = new PrismaMySQL(connectionString)
  
  const binder = (driver: Driver & Closeable): Driver & Closeable => ({
    queryRaw: driver.queryRaw.bind(driver),
    executeRaw: driver.executeRaw.bind(driver),
    version: driver.version.bind(driver),
    isHealthy: driver.isHealthy.bind(driver),
    close: driver.close.bind(driver),
  })

  return binder(db)
}
