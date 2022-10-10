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
    const { rows } = await this.db.query(`
      SELECT * FROM ${table}
      ORDER BY id ASC;
    `)

    // convert values that could be numbers into numbers for consistency.
    return rows.map((row) => Object.fromEntries(Object.entries(row).map(parseKeyValueToInt)))
  }

  async end() {
    return this.db.end()
  }
}

function parseKeyValueToInt(entry: [string, unknown]): [string, unknown | number] {
  const [key, value] = entry

  if (typeof value !== 'string') {
    return entry
  }

  const n = Number.parseInt(value, 10)
  if (Number.isNaN(n)) {
    return entry
  }

  return [key, n]
}
