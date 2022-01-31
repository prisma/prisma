import fs from 'fs'
import path from 'path'
import { uriToCredentials } from '@prisma/sdk'
import mariadb from 'mariadb'

export type SetupParams = {
  connectionString: string
  dirname: string
}

export async function setupMysql(options: SetupParams): Promise<void> {
  const { connectionString } = options
  const { dirname } = options
  const credentials = uriToCredentials(connectionString)

  let schema = `
  CREATE DATABASE IF NOT EXISTS \`${credentials.database}-shadowdb\`;
  CREATE DATABASE IF NOT EXISTS \`${credentials.database}\`;
  `
  if (dirname !== '') {
    schema += fs.readFileSync(path.join(dirname, 'setup.sql'), 'utf-8')
  }

  const db = await mariadb.createConnection({
    host: credentials.host,
    port: credentials.port,
    // database: credentials.database, // use the default db
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
