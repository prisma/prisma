/* eslint-disable */

import * as mysql from 'mysql2/promise'
import type { Driver, Closeable, ResultSet, Query } from '../types/Library'
import { ColumnType } from '../types/Library'
import { binder } from './utils/binder'

/**
 * This is a simplification of quaint's value inference logic. Take a look at quaint's conversion.rs
 * module to see how other attributes of the field packet such as the field length are used to infer
 * the correct quaint::Value variant.
 * See: https://github.com/mysql/mysql-server/blob/ea7087d885006918ad54458e7aad215b1650312c/include/field_types.h#L52-L87
 */

// offset: 0
const columnTypeArrayHead = [
  undefined, /* Decimal */
  undefined, /* Tiny */
  undefined, /* Short */
  ColumnType.Int64, /* Long */
  undefined, /* Float */
  undefined, /* Double */
  undefined, /* Null */
  undefined, /* Timestamp */
  undefined, /* LongLong */
  undefined, /* Int24 */
  undefined, /* Date */
  undefined, /* Time */
  undefined, /* Datetime */
  undefined, /* Year */
  undefined, /* Newdate < Internal to MySQL. Not used in protocol */
  undefined, /* Varchar */
  undefined, /* Bit */
  undefined, /* Timestamp2 */
  undefined, /* Datetime2 < Internal to MySQL. Not used in protocol */
  undefined, /* Time2 < Internal to MySQL. Not used in protocol */
  undefined, /* TypedArray < Used for replication only */
]

// offset: 243
const columnTypeArrayTail = [
  undefined, /* Invalid */
  undefined, /* Bool < Currently just a placeholder */
  undefined, /* Json */
  undefined, /* Newdecimal */
  undefined, /* Enum */
  undefined, /* Set */
  undefined, /* TinyBlob */
  undefined, /* MediumBlob */
  undefined, /* LongBlob */
  undefined, /* Blob */
  ColumnType.Text, /* VarString */
  undefined, /* String */
  undefined, /* Geometry */
]

function fieldToColumnType({ type: typeIdx }: mysql.FieldPacket): ColumnType {
  const colType = columnTypeArrayHead[typeIdx] ?? columnTypeArrayTail[typeIdx - 243]

  if (colType === undefined) {
    throw new Error(`Unsupported mysql type: ${typeIdx}`)
  }
  
  return colType
}

class PrismaMySQL implements Driver, Closeable {
  private pool: mysql.Pool
  private maybeVersion?: string
  private isRunning: boolean = true

  constructor(connectionString: string) {
    this.pool = mysql.createPool(connectionString)

    // lazily retrieve the version and store it into `maybeVersion`
    this.pool.query<mysql.RowDataPacket[]>({
      sql: 'SELECT @@version, @@GLOBAL.version',
    }).then(([results, _]) => {
      this.maybeVersion = results[0]['@@version']
    })
  }

  async close(): Promise<void> {
    if (this.isRunning) {
      this.isRunning = false
      await this.pool.end()
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
    const [results, fields] = await this.pool.query<mysql.RowDataPacket[]>({
      sql,
      values,
      rowsAsArray: false,
    })

    const columns = fields.map(field => field.name)
    const resultSet: ResultSet = {
      columnNames: columns,
      columnTypes: fields.map(field => fieldToColumnType(field)),
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
    const [{ affectedRows }, _] = await this.pool.execute<mysql.ResultSetHeader>({
      sql,
      values,
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
  return binder(db)
}
