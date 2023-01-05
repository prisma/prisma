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
export type PrettyProvider = 'MySQL' | 'PostgreSQL' | 'SQLite' | 'SQL Server' | 'CockroachDB' | 'MongoDB'

// TODO: extract functions in their own files?

export type DatasourceInfo = {
  name?: string // from datasource name
  url: string // from getConfig
  dbLocation?: string // host without credentials
  dbType: PrettyProvider // pretty name for the provider
  dbName?: string // database name
  schema?: string // database schema (!= multiSchema, can be found in the connection string like `?schema=myschema`)
  schemas?: string[] // database schemas from the datasource (multiSchema preview feature)
}

// todo
export async function getDatasourceInfo(schemaPath?: string): Promise<DatasourceInfo> {
  const schema = await getSchema(schemaPath)
  const config = await getConfig({ datamodel: schema, ignoreEnvVarErrors: false })
  const firstDatasource = config.datasources?.[0]

  if (!firstDatasource) {
    throw new Error(`A datasource block is missing in the Prisma schema file.`)
  }

  const url = firstDatasource.url.value

  let dbType
  switch (firstDatasource.provider) {
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
    case 'mongodb':
      dbType = `MongoDB`
      break
  }

  if (firstDatasource.provider === 'sqlserver') {
    return {
      name: firstDatasource.name,
      dbType,
      dbName: undefined,
      dbLocation: undefined,
      url: firstDatasource.url.value,
      schemas: firstDatasource.schemas,
    }
  }

  try {
    const credentials = uriToCredentials(url)
    const dbLocation = getDbLocation(credentials)
    const dbinfoFromCredentials = getDbinfoFromCredentials(credentials)

    let schema: string | undefined = undefined
    if (['postgresql', 'cockroachdb'].includes(firstDatasource.provider)) {
      if (credentials.schema) {
        schema = credentials.schema
      } else {
        schema = 'public'
      }
    }

    const datasourceInfo = {
      name: firstDatasource.name,
      dbType,
      dbLocation,
      ...dbinfoFromCredentials,
      url,
      schema,
      schemas: firstDatasource.schemas,
    }

    // Default to `postgres` database name for PostgreSQL
    // It's not 100% accurate but it's the best we can do here
    if (firstDatasource.provider === 'postgresql' && datasourceInfo.dbName === undefined) {
      datasourceInfo.dbName = 'postgres'
    }

    return datasourceInfo
  } catch (e) {
    console.error(e)
    return {
      name: firstDatasource.name,
      dbType,
      dbName: undefined,
      dbLocation: undefined,
      url,
      schemas: firstDatasource.schemas,
    }
  }
}

// check if we can connect to the database
// if true: return true
// if false: throw error
export async function ensureCanConnectToDatabase(schemaPath?: string): Promise<Boolean | Error> {
  const schema = await getSchema(schemaPath)
  const config = await getConfig({ datamodel: schema, ignoreEnvVarErrors: false })
  const firstDatasource = config.datasources[0]

  if (!firstDatasource) {
    throw new Error(`A datasource block is missing in the Prisma schema file.`)
  }

  const schemaDir = (await getSchemaDir(schemaPath))!

  const canConnect = await canConnectToDatabase(firstDatasource.url.value, schemaDir)

  if (canConnect === true) {
    return true
  } else {
    const { code, message } = canConnect
    throw new Error(`${code}: ${message}`)
  }
}

export async function ensureDatabaseExists(action: MigrateAction, schemaPath?: string) {
  const schema = await getSchema(schemaPath)
  const config = await getConfig({ datamodel: schema, ignoreEnvVarErrors: false })
  const firstDatasource = config.datasources[0]

  if (!firstDatasource) {
    throw new Error(`A datasource block is missing in the Prisma schema file.`)
  }

  const schemaDir = (await getSchemaDir(schemaPath))!

  const canConnect = await canConnectToDatabase(firstDatasource.url.value, schemaDir)
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

  if (await createDatabase(firstDatasource.url.value, schemaDir)) {
    // URI parsing is not implemented for SQL server yet
    if (firstDatasource.provider === 'sqlserver') {
      return `SQL Server database created.\n`
    }

    // parse the url
    const credentials = uriToCredentials(firstDatasource.url.value)
    const { dbName } = getDbinfoFromCredentials(credentials)

    return `${firstDatasource.provider} database ${chalk.bold(dbName)} created at ${chalk.bold(
      getDbLocation(credentials),
    )}`
  }

  return undefined
}

// returns the "host" like localhost / 127.0.0.1 + default port
export function getDbLocation(credentials: DatabaseCredentials): string | undefined {
  if (credentials.type === 'sqlite') {
    return credentials.uri!
  }

  if (credentials.host && credentials.port) {
    return `${credentials.host}:${credentials.port}`
  } else if (credentials.host) {
    return `${credentials.host}`
  }

  return undefined
}

// returns database name + pretty name of db provider
export function getDbinfoFromCredentials(credentials: DatabaseCredentials): {
  dbName: string | undefined // database name
} {
  const dbName = credentials.database

  return {
    dbName,
  }
}
