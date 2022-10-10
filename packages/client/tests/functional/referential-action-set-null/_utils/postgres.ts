import { Client } from 'pg'

import { AbstractDatabaseRunner, DatabaseRunnerQueries } from './DatabaseRunner'
import type { SetupParams } from './types'

// connect to the database, run a query, disconnect from the database
export async function runAndForget(options: SetupParams, stmt: string) {
  const { connectionString } = options
  const db = new Client({
    connectionString,
  })

  await db.connect()

  try {
    await db.query(stmt)
  } finally {
    await db.end()
  }
}
export class DatabaseRunner extends AbstractDatabaseRunner {
  static async new(options: SetupParams, queries: DatabaseRunnerQueries) {
    const { connectionString } = options
    const db = new Client({
      connectionString,
    })

    await db.connect()

    return new DatabaseRunner(db, queries)
  }

  private constructor(private db: Client, queries: DatabaseRunnerQueries) {
    super(queries)
  }

  query(stmt: string) {
    return this.db.query(stmt)
  }

  async selectAllFrom(table: string) {
    const result = await this.db.query(`
      SELECT * FROM ${table};
    `)
    return result.rows
  }

  async end() {
    return this.db.end()
  }
}
