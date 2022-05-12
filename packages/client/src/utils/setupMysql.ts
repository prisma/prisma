import { createDatabase, uriToCredentials } from '@prisma/sdk'
import fs from 'fs'
import mariadb from 'mariadb'
import path from 'path'

export type SetupParams = {
  connectionString: string
  dirname: string
}

export async function setupMysql(options: SetupParams): Promise<void> {
  const { connectionString } = options
  const { dirname } = options
  const schema = fs.readFileSync(path.join(dirname, 'setup.sql'), 'utf-8')

  await createDatabase(connectionString).catch((e) => console.error(e))

  const credentials = uriToCredentials(connectionString)
  const db = await mariadb.createConnection({
    host: credentials.host,
    port: credentials.port,
    database: credentials.database,
    user: credentials.user,
    password: credentials.password,
    socketPath: credentials.socket,
    multipleStatements: true,
  })

  await db.query(schema)
  await db.end()
}

export async function tearDownMysql(connectionString: string) {
  const credentials = uriToCredentials(connectionString)

  const credentialsClone = { ...credentials }
  credentialsClone.database = 'mysql'

  const db = await mariadb.createConnection({
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
