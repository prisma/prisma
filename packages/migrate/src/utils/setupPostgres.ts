import fs from 'fs'
import path from 'path'
import { createDatabase, uriToCredentials, credentialsToUri } from '@prisma/sdk'
import { Client } from 'pg'

export type SetupParams = {
  connectionString: string
  dirname: string
}

export async function setupPostgres(options: SetupParams): Promise<void> {
  const { connectionString } = options
  const { dirname } = options
  const credentials = uriToCredentials(connectionString)

  let schema = `
  SELECT 'CREATE DATABASE tests-migrate-shadowdb' WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'tests-migrate-shadowdb');
  SELECT 'CREATE DATABASE ${credentials.database}' WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = '${credentials.database}');
  `
  if (dirname !== '') {
    schema += fs.readFileSync(path.join(dirname, 'setup.sql'), 'utf-8')
  }

  await createDatabase(connectionString).catch((e) => console.error(e))

  const db = new Client({
    connectionString: connectionString,
  })

  await db.connect()
  await db.query(schema)
  await db.end()
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
