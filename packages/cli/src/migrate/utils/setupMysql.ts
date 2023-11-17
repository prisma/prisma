import { uriToCredentials } from '@prisma/internals'
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
  const credentials = uriToCredentials(connectionString)

  // Connect to default db
  const dbDefault = await mariadb.createConnection({
    host: credentials.host,
    port: credentials.port,
    // database: credentials.database, // use the default db
    user: credentials.user,
    password: credentials.password,
    multipleStatements: true,
    allowPublicKeyRetrieval: true,
  })
  await dbDefault.query(`
CREATE DATABASE IF NOT EXISTS \`${credentials.database}-shadowdb\`;
CREATE DATABASE IF NOT EXISTS \`${credentials.database}\`;
`)
  await dbDefault.end()

  if (dirname !== '') {
    const db = await mariadb.createConnection({
      host: credentials.host,
      port: credentials.port,
      database: credentials.database, // use final db
      user: credentials.user,
      password: credentials.password,
      multipleStatements: true,
      allowPublicKeyRetrieval: true,
    })
    await db.query(fs.readFileSync(path.join(dirname, 'setup.sql'), 'utf-8'))
    await db.end()
  }
}

export async function tearDownMysql(options: SetupParams) {
  const { connectionString } = options

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
    allowPublicKeyRetrieval: true,
  })

  await db.query(`
    DROP DATABASE IF EXISTS \`${credentials.database}\`;
  `)
  await db.end()
}
