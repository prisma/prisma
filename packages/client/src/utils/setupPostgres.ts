import { createDatabase, credentialsToUri, uriToCredentials } from '@prisma/internals'
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
  const schema = fs.readFileSync(path.join(dirname, 'setup.sql'), 'utf-8')

  await createDatabase(connectionString).catch((e) => console.error(e))

  const db = new Client({
    connectionString: connectionString,
  })

  await db.connect()
  await db.query(schema)
  await db.end()
}

export async function tearDownPostgres(connectionString: string) {
  const credentials = uriToCredentials(connectionString)
  const credentialsClone = { ...credentials }
  credentialsClone.database = 'postgres'
  credentialsClone.schema = ''
  const connectionStringCopy = credentialsToUri(credentialsClone)

  const db = new Client({
    connectionString: connectionStringCopy,
  })

  try {
    await db.connect()
    await db.query(`
    DROP DATABASE IF EXISTS "${credentials.database}";
  `)
  } catch (e) {
    console.error(e)
  }
  await db.end()
}
