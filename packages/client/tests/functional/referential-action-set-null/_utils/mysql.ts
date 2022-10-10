import { uriToCredentials } from '@prisma/internals'
import mariadb from 'mariadb'

export type SetupParams = {
  connectionString: string
}

export async function createTable(options: SetupParams, createTableStmt: string) {
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
    await db.query(createTableStmt)
  } finally {
    await db.end()
  }
}
