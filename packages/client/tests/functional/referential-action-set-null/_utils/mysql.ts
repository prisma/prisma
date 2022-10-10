import { uriToCredentials } from '@prisma/internals'
import mariadb from 'mariadb'

import { AbstractDatabaseRunner, DatabaseRunnerQueries } from './DatabaseRunner'
import type { SetupParams } from './types'

// connect to the database, run a query, disconnect from the database
export async function runAndForget(options: SetupParams, stmt: string) {
  const { connectionString } = options
  const credentials = uriToCredentials(connectionString)

  const db = await mariadb.createConnection({
    host: credentials.host,
    port: credentials.port,
    database: credentials.database, // use final db
    user: credentials.user,
    password: credentials.password,
    multipleStatements: true,
  })

  try {
    await db.query(stmt)
  } finally {
    await db.end()
  }
}

export class DatabaseRunner extends AbstractDatabaseRunner {
  static async new(options: SetupParams, queries: DatabaseRunnerQueries) {
    const { connectionString } = options
    const credentials = uriToCredentials(connectionString)

    const db = await mariadb.createConnection({
      host: credentials.host,
      port: credentials.port,
      database: credentials.database, // use final db
      user: credentials.user,
      password: credentials.password,
      multipleStatements: true,
    })

    return new DatabaseRunner(db, queries)
  }

  private constructor(private db: mariadb.Connection, queries: DatabaseRunnerQueries) {
    super(queries)
  }

  query(stmt: string) {
    return this.db.query(stmt)
  }

  async selectAllFrom(table: string) {
    const result = await this.db.query(`
      SELECT * FROM ${table};
    `)
    return [...result]
  }

  async end() {
    return this.db.end()
  }
}
