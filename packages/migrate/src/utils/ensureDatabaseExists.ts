import type { DatabaseCredentials } from '@prisma/internals'
import {
  canConnectToDatabase,
  createDatabase,
  getConfig,
  getSchema,
  getSchemaDir,
  uriToCredentials,
} from '@prisma/internals'
import chalk from 'chalk'

export type MigrateAction = 'create' | 'apply' | 'unapply' | 'dev' | 'push'
export type DbType = 'MySQL' | 'PostgreSQL' | 'SQLite' | 'SQL Server' | 'CockroachDB'

// TODO: extract functions in their own files?

export async function getDatasourceInfo(schemaPath?: string): Promise<{
  name?: string // from datasource name
  url?: string // from getConfig
  dbLocation?: string // host without credentials
  dbType?: DbType // pretty name
  dbName?: string // database name
  schema?: string // only for postgres right now (but SQL Server has this concept too)
}> {
  const datamodel = await getSchema(schemaPath)
  const config = await getConfig({ datamodel, ignoreEnvVarErrors: false })
  const activeDatasource = config.datasources?.[0]

  if (!activeDatasource) {
    return {
      name: undefined,
      dbType: undefined,
      dbName: undefined,
      dbLocation: undefined,
      url: undefined,
    }
  }

  const url = activeDatasource.url.value

  if (activeDatasource.provider === 'sqlserver') {
    return {
      name: activeDatasource.name,
      dbType: 'SQL Server',
      dbName: undefined,
      dbLocation: undefined,
      url: activeDatasource.url.value,
    }
  }

  try {
    const credentials = uriToCredentials(url)
    const dbLocation = getDbLocation(credentials)
    const dbinfoFromCredentials = getDbinfoFromCredentials(credentials)

    const datasourceInfo = {
      name: activeDatasource.name,
      dbLocation,
      ...dbinfoFromCredentials,
      url,
      schema: credentials.schema,
    }

    // For CockroachDB we cannot rely on the connection URL, only on the provider
    if (activeDatasource.provider === 'cockroachdb') {
      datasourceInfo.dbType = 'CockroachDB'
    }

    return datasourceInfo
  } catch (e) {
    return {
      name: activeDatasource.name,
      dbType: undefined,
      dbName: undefined,
      dbLocation: undefined,
      url,
    }
  }
}

// check if we can connect to the database
// if true: return true
// if false: throw error
export async function ensureCanConnectToDatabase(schemaPath?: string): Promise<Boolean | Error> {
  const datamodel = await getSchema(schemaPath)
  const config = await getConfig({ datamodel, ignoreEnvVarErrors: false })
  const activeDatasource = config.datasources[0]

  if (!activeDatasource) {
    throw new Error(`Couldn't find a datasource in the schema.prisma file`)
  }

  const schemaDir = (await getSchemaDir(schemaPath))!

  const canConnect = await canConnectToDatabase(activeDatasource.url.value, schemaDir)

  if (canConnect === true) {
    return true
  } else {
    const { code, message } = canConnect
    throw new Error(`${code}: ${message}`)
  }
}

export async function ensureDatabaseExists(action: MigrateAction, schemaPath?: string) {
  const datamodel = await getSchema(schemaPath)
  const config = await getConfig({ datamodel, ignoreEnvVarErrors: false })
  const activeDatasource = config.datasources[0]

  if (!activeDatasource) {
    throw new Error(`Couldn't find a datasource in the schema.prisma file`)
  }

  const schemaDir = (await getSchemaDir(schemaPath))!

  const canConnect = await canConnectToDatabase(activeDatasource.url.value, schemaDir)
  if (canConnect === true) {
    return
  }
  const { code, message } = canConnect

  // P1003 means we can connect but that the database doesn't exist
  if (code !== 'P1003') {
    throw new Error(`${code}: ${message}`)
  }

  // last case: status === 'DatabaseDoesNotExist'

  // a bit weird, is that ever reached?
  if (!schemaDir) {
    throw new Error(`Could not locate ${schemaPath || 'schema.prisma'}`)
  }

  if (await createDatabase(activeDatasource.url.value, schemaDir)) {
    // URI parsing is not implemented for SQL server yet
    if (activeDatasource.provider === 'sqlserver') {
      return `SQL Server database created.\n`
    }

    // parse the url
    const credentials = uriToCredentials(activeDatasource.url.value)
    const { dbType, dbName } = getDbinfoFromCredentials(credentials)
    let databaseProvider = dbType

    // not needed to check for sql server here since we returned already earlier if provider = sqlserver
    if (dbType && dbType !== 'SQL Server') {
      // For CockroachDB we cannot rely on the connection URL, only on the provider
      if (activeDatasource.provider === 'cockroachdb') {
        databaseProvider = 'CockroachDB'
      }
      return `${databaseProvider} database ${chalk.bold(dbName)} created at ${chalk.bold(getDbLocation(credentials))}`
    } else {
      // SQL Server case, never reached?
      return `Database created.`
    }
  }

  return undefined
}

// returns the "host" like localhost / 127.0.0.1 + default port
export function getDbLocation(credentials: DatabaseCredentials): string {
  if (credentials.type === 'sqlite') {
    return credentials.uri!
  }

  if (!credentials.port) {
    switch (credentials.type) {
      case 'mysql':
        credentials.port = 3306
        break
      case 'postgresql':
        credentials.port = 5432
        break
      case 'sqlserver':
        credentials.port = 1433
        break
    }
  }

  return `${credentials.host}:${credentials.port}`
}

// returns database name + pretty name of db provider
export function getDbinfoFromCredentials(credentials: DatabaseCredentials): {
  dbName: string | undefined // database name
  dbType: DbType // pretty name
} {
  const dbName = credentials.database

  let dbType
  switch (credentials.type) {
    case 'mysql':
      dbType = `MySQL`
      break
    case 'postgresql':
      dbType = `PostgreSQL`
      break
    case 'sqlite':
      dbType = `SQLite`
      break
    case 'cockroachdb':
      dbType = `CockroachDB`
      break
    // this is never reached as url parsing for sql server is not implemented
    case 'sqlserver':
      dbType = `SQL Server`
      break
  }

  return {
    dbName,
    dbType,
  }
}
