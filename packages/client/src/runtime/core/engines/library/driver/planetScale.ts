/* eslint-disable */

import * as planetScale from '@planetscale/database' 
import type { Driver, Closeable, ResultSet, Query } from '../types/Library'
import { ColumnType } from '../types/Library'
import { binder } from './utils/binder'

/**
 * This is a simplification of quaint's value inference logic. Take a look at quaint's conversion.rs
 * module to see how other attributes of the field packet such as the field length are used to infer
 * the correct quaint::Value variant.
 * See: https://github.com/mysql/mysql-server/blob/ea7087d885006918ad54458e7aad215b1650312c/include/field_types.h#L52-L87
 */

function fieldToColumnType(type: 'INT32' | 'VARCHAR' | string): ColumnType {
  switch (type) {
    case 'INT32':
      return ColumnType.Int64 // trick Quaint into thinking it's a 64-bit integer
    case 'VARCHAR':
      return ColumnType.Text
    default:
      throw new Error(`Unsupported planetscale type: ${type}`)
  }
}

type PlanetscaleConfig = {
  host: string,
  username: string,
  password: string,
}

class PrismaPlanetscale implements Driver, Closeable {
  private client: planetScale.Connection
  private maybeVersion?: string
  private isRunning: boolean = true

  constructor(config: PlanetscaleConfig) {
    this.client = planetScale.connect(config)

    // lazily retrieve the version and store it into `maybeVersion`
    this.client.execute('SELECT @@version, @@GLOBAL.version').then((results) => {
      this.maybeVersion = results.rows[0]['@@version']
    })
  }

  async close(): Promise<void> {
    if (this.isRunning) {
      this.isRunning = false
    }
  }

  /**
   * Returns false, if connection is considered to not be in a working state.
   */
  isHealthy(): boolean {
    const result = this.maybeVersion !== undefined
      && this.isRunning
    return result
  }
  
  /**
   * Execute a query given as SQL, interpolating the given parameters.
   */
  async queryRaw(query: Query): Promise<ResultSet> {
    const { sql, args: values } = query
    const { fields, rows: results } = await this.client.execute(sql, values, { as: 'object' })

    const columns = fields.map(field => field.name)
    const resultSet: ResultSet = {
      columnNames: columns,
      columnTypes: fields.map(field => fieldToColumnType(field.type)),
      rows: results.map(result => columns.map(column => result[column])),
    }

    return resultSet
  }

  /**
   * Execute a query given as SQL, interpolating the given parameters and
   * returning the number of affected rows.
   * Note: Queryable expects a u64, but napi.rs only supports u32.
   */
  async executeRaw(query: Query): Promise<number> {
    const { sql, args: values } = query
    const { rowsAffected } = await this.client.execute(sql, values)
    return rowsAffected
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

export const createPlanetscaleDriver = (config: PlanetscaleConfig): Driver & Closeable => {
  const db = new PrismaPlanetscale(config)
  return binder(db)
}
