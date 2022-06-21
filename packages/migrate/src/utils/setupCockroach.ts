import { credentialsToUri, uriToCredentials } from '@prisma/internals'
import fs from 'fs'
import path from 'path'
import { Client } from 'pg'

export async function setupCockroach(options: { connectionString: string; dirname: string }): Promise<void> {
  const { connectionString } = options
  const { dirname } = options
  const credentials = uriToCredentials(connectionString)

  // Connect to default db
  const dbDefault = new Client({
    connectionString: connectionString.replace(credentials.database!, 'cockroachdb'),
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

export async function tearDownCockroach(options: { connectionString: string }) {
  const { connectionString } = options
  const credentials = uriToCredentials(connectionString)
  const credentialsClone = { ...credentials }
  credentialsClone.database = 'cockroachdb'
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
