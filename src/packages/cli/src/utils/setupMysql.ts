import fs from 'fs'
import path from 'path'
import { createDatabase, uriToCredentials } from '@prisma/sdk'
import mariadb from 'mariadb'

export type SetupParams = {
  connectionString: string
  dirname: string
}

export async function setupMysql(options: SetupParams): Promise<void> {
  const { connectionString } = options
  const { dirname } = options
  const schema = fs.readFileSync(path.join(dirname, 'setup.sql'), 'utf-8')

  await createDatabase(connectionString).catch((e) => console.error(e))

  let db: mariadb.Connection
  const credentials = uriToCredentials(connectionString)
  db = await mariadb.createConnection({
    host: credentials.host,
    port: credentials.port,
    database: credentials.database,
    user: credentials.user,
    password: credentials.password,
    multipleStatements: true,
  })

  await db.query(schema)
  await db.end()
}

export async function tearDownMysql(options: SetupParams) {
  const { connectionString } = options

  const credentials = uriToCredentials(connectionString)

  const credentialsClone = { ...credentials }
  credentialsClone.database = 'tests'

  let db: mariadb.Connection
  db = await mariadb.createConnection({
    host: credentialsClone.host,
    port: credentialsClone.port,
    database: credentialsClone.database,
    user: credentialsClone.user,
    password: credentialsClone.password,
    multipleStatements: true,
  })

  await db.query(`
    DROP DATABASE IF EXISTS \`${credentials.database}\`;
  `)
  await db.end()
}
