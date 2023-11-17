import mongo from 'mongoose'
import path from 'path'

export type SetupParams = {
  connectionString: string
  dirname: string
}

export async function setupMongo(options: SetupParams): Promise<void> {
  const { connectionString, dirname } = options

  // Connect to default db
  const dbDefault = mongo.createConnection(connectionString)
  await dbDefault.dropDatabase()
  await dbDefault.close()

  if (dirname !== '') {
    // Connect to final db and populate
    const db = mongo.createConnection(connectionString)
    await db.dropDatabase()

    const setupPath = path.join(dirname, 'setup')
    const { setup } = require(setupPath)
    await setup(db)
    await db.close()
  }
}

export async function inspectMongo(options: SetupParams): Promise<any> {
  const { connectionString, dirname } = options

  const db = mongo.createConnection(connectionString)

  const inspectPath = path.join(dirname, 'setup')
  const { inspect } = require(inspectPath)

  const result = await inspect(db)
  await db.close()
  return result
}

export async function tearDownMongo(options: SetupParams) {
  const { connectionString } = options

  const dbDefault = mongo.createConnection(connectionString)
  await dbDefault.dropDatabase()
  await dbDefault.close()
}
