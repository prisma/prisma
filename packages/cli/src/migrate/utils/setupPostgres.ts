import { credentialsToUri, uriToCredentials } from '@prisma/internals'
import fs from 'fs'
import path from 'path'
import { Client } from 'pg'

export type SetupParams = {
  connectionString: string
  dirname: string
}

export async function setupPostgres(options: SetupParams): Promise<void> {
  const { connectionString } = options
  const { dirname } = options
  const credentials = uriToCredentials(connectionString)

  // Connect to default db
  const dbDefault = new Client({
    connectionString: connectionString.replace(credentials.database!, 'postgres'),
  })
  await dbDefault.connect()
  await dbDefault.query(`DROP DATABASE IF EXISTS "${credentials.database}-shadowdb";`)
  await dbDefault.query(`CREATE DATABASE "${credentials.database}-shadowdb";`)
  await dbDefault.query(`DROP DATABASE IF EXISTS "${credentials.database}";`)
  await dbDefault.query(`CREATE DATABASE "${credentials.database}";`)
  await dbDefault.end()

  if (dirname !== '') {
    // Connect to final db and populate
    const db = new Client({
      connectionString: connectionString,
    })
    await db.connect()
    await db.query(fs.readFileSync(path.join(dirname, 'setup.sql'), 'utf-8'))
    await db.end()
  }
}

export async function tearDownPostgres(options: SetupParams) {
  const { connectionString } = options
  const credentials = uriToCredentials(connectionString)
  const credentialsClone = { ...credentials }
  credentialsClone.database = 'postgres'
  credentialsClone.schema = ''
  const connectionStringCopy = credentialsToUri(credentialsClone)

  const db = new Client({
    connectionString: connectionStringCopy,
  })

  await db.connect()
  await db.query(`
    DROP DATABASE IF EXISTS "${credentials.database}";
  `)
  await db.end()
}

/**
 * Run an arbitrary query against a Postgres database.
 * Procedural `plpgsql` queries are also supported.
 * This function should be called after `setupPostgres` and before `tearDownPostgres`.
 * The given `options.connectionString` is used as is.
 */
export async function runQueryPostgres(options: SetupParams, query: string): Promise<void> {
  const { connectionString } = options

  // Connect to default db
  const dbDefault = new Client({
    connectionString,
  })
  await dbDefault.connect()
  await dbDefault.query(query)
  await dbDefault.end()
}
