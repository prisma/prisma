import mssql from 'mssql'

import { AbstractDatabaseRunner, DatabaseRunnerQueries } from './DatabaseRunner'
import type { SetupParams } from './types'

// connect to the database, run a query, disconnect from the database
export async function runAndForget(options: SetupParams, stmt: string) {
  const { connectionString } = options
  const config = getMSSQLConfig(connectionString)
  const connectionPool = new mssql.ConnectionPool(config)
  const connection = await connectionPool.connect()

  try {
    await connection.query(stmt)
  } finally {
    await connection.close()
  }
}

export class DatabaseRunner extends AbstractDatabaseRunner {
  static async new(options: SetupParams, queries: DatabaseRunnerQueries) {
    const { connectionString } = options
    const config = getMSSQLConfig(connectionString)
    const connectionPool = new mssql.ConnectionPool(config)
    const connection = await connectionPool.connect()

    return new DatabaseRunner(connection, queries)
  }

  private constructor(private db: mssql.ConnectionPool, queries: DatabaseRunnerQueries) {
    super(queries)
  }

  query(stmt: string) {
    return this.db.query(stmt)
  }

  async selectAllFrom(table: string) {
    const result = await this.db.query(`
      SELECT * FROM ${table};
    `)
    return result.recordset as any[]
  }

  async end() {
    return this.db.close()
  }
}

function getMSSQLConfig(url: string): mssql.config {
  const connectionUrl = new URL(url)
  return {
    user: connectionUrl.username,
    password: connectionUrl.password,
    server: connectionUrl.hostname,
    port: Number(connectionUrl.port),
    database: connectionUrl.pathname.substring(1),
    pool: {
      max: 1,
    },
    options: {
      enableArithAbort: false,
      trustServerCertificate: true, // change to true for local dev / self-signed certs
    },
  }
}
