import { Client } from 'pg'

export type SetupParams = {
  connectionString: string
}

export async function createTable(options: SetupParams, createTableStmt: string) {
  const { connectionString } = options
  const db = new Client({
    connectionString,
  })

  await db.connect()

  try {
    await db.query(createTableStmt)
  } finally {
    await db.end()
  }
}
