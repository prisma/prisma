import type { ConfigMetaFormat, DatabaseCredentials } from '@prisma/internals'
import {
  canConnectToDatabase,
  createDatabase,
  getConfig,
  getEffectiveUrl,
  getMigrateConfigDir,
  getSchema,
  PRISMA_POSTGRES_PROVIDER,
  uriToCredentials,
} from '@prisma/internals'
import { bold } from 'kleur/colors'

import type { ConnectorType } from './printDatasources'
import { getSocketFromDatabaseCredentials } from './unixSocket'

export type MigrateAction = 'create' | 'apply' | 'unapply' | 'dev' | 'push'
export type PrettyProvider =
  | 'MySQL'
  | 'PostgreSQL'
  | 'Prisma Postgres'
  | 'SQLite'
  | 'SQL Server'
  | 'CockroachDB'
  | 'MongoDB'

// TODO: extract functions in their own files?

export type DatasourceInfo = {
  name?: string // from datasource name
  prettyProvider?: PrettyProvider // pretty name for the provider
  url?: string // from getConfig
  dbLocation?: string // host without credentials
  dbName?: string // database name
  schema?: string // database schema (!= multiSchema, can be found in the connection string like `?schema=myschema`)
  schemas?: string[] // database schemas from the datasource (multiSchema preview feature)
  configDir?: string
}

// TODO: sometimes this function is called with a `schemaPath`, even though the schema(s) have already been read from disk.
// (e.g., check `MigrateDev.ts`).
export async function getDatasourceInfo({
  schemaPath,
  throwIfEnvError,
}: { schemaPath?: string; throwIfEnvError?: boolean } = {}): Promise<DatasourceInfo> {
  const schema = await getSchema(schemaPath)
  let config: ConfigMetaFormat

  // Try parsing the env var if defined
  // Because we want to get the database name from the url later in the function
  // If it fails we try again but ignore the env var error
  try {
    config = await getConfig({ datamodel: schema, ignoreEnvVarErrors: false })
  } catch (error) {
    // Note: only used for db drop (which is not exposed in the CLI)
    if (throwIfEnvError) {
      throw error
    }
    config = await getConfig({ datamodel: schema, ignoreEnvVarErrors: true })
  }

  const firstDatasource = config.datasources[0] ? config.datasources[0] : undefined

  if (!firstDatasource) {
    return {
      name: undefined,
      prettyProvider: undefined,
      dbName: undefined,
      dbLocation: undefined,
      url: undefined,
      schema: undefined,
      schemas: undefined,
      configDir: undefined,
    }
  }

  const prettyProvider = prettifyProvider(firstDatasource.provider)
  const url = getEffectiveUrl(firstDatasource).value

  // url parsing for sql server is not implemented
  if (!url || firstDatasource.provider === 'sqlserver') {
    return {
      name: firstDatasource.name,
      prettyProvider,
      dbName: undefined,
      dbLocation: undefined,
      url: url || undefined,
      schema: undefined,
      schemas: firstDatasource.schemas,
      configDir: getMigrateConfigDir(config, schemaPath),
    }
  }

  try {
    const credentials = uriToCredentials(url)
    const dbLocation = getDbLocation(credentials)

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
      prettyProvider,
      dbName: credentials.database,
      dbLocation,
      url,
      schema,
      schemas: firstDatasource.schemas,
      configDir: getMigrateConfigDir(config, schemaPath),
    }

    // Default to `postgres` database name for PostgreSQL
    // It's not 100% accurate but it's the best we can do here
    if (firstDatasource.provider === 'postgresql' && datasourceInfo.dbName === undefined) {
      datasourceInfo.dbName = 'postgres'
    }

    return datasourceInfo
  } catch (_e) {
    return {
      name: firstDatasource.name,
      prettyProvider,
      dbName: undefined,
      dbLocation: undefined,
      url,
      schema: undefined,
      schemas: firstDatasource.schemas,
      configDir: getMigrateConfigDir(config, schemaPath),
    }
  }
}

// check if we can connect to the database
// if true: return true
// if false: throw error
export async function ensureCanConnectToDatabase(schemaPath?: string): Promise<boolean | Error> {
  const schema = await getSchema(schemaPath)
  const config = await getConfig({ datamodel: schema, ignoreEnvVarErrors: false })
  const firstDatasource = config.datasources[0] ? config.datasources[0] : undefined

  if (!firstDatasource) {
    throw new Error('A datasource block is missing in the Prisma schema file.')
  }

  const schemaDir = getMigrateConfigDir(config, schemaPath)
  const url = getEffectiveUrl(firstDatasource).value

  // url exists because `ignoreEnvVarErrors: false` would have thrown an error if not
  const canConnect = await canConnectToDatabase(url!, schemaDir)

  if (canConnect === true) {
    return true
  }
  const { code, message } = canConnect
  throw new Error(`${code}: ${message}`)
}

export async function ensureDatabaseExists(_action: MigrateAction, schemaPath?: string) {
  const schemas = await getSchema(schemaPath)

  const config = await getConfig({ datamodel: schemas, ignoreEnvVarErrors: false })
  const firstDatasource = config.datasources[0] ? config.datasources[0] : undefined

  if (!firstDatasource) {
    throw new Error('A datasource block is missing in the Prisma schema file.')
  }

  const schemaDir = getMigrateConfigDir(config, schemaPath)
  const url = getEffectiveUrl(firstDatasource).value

  // url exists because `ignoreEnvVarErrors: false` would have thrown an error if not
  const canConnect = await canConnectToDatabase(url!, schemaDir)
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

  // url.value exists because `ignoreEnvVarErrors: false` would have thrown an error if not
  if (await createDatabase(url!, schemaDir)) {
    // URI parsing is not implemented for SQL server yet
    if (firstDatasource.provider === 'sqlserver') {
      return 'SQL Server database created.\n'
    }

    // parse the url
    // url.value exists because `ignoreEnvVarErrors: false` would have thrown an error if not
    const credentials = uriToCredentials(url!)
    const prettyProvider = prettifyProvider(firstDatasource.provider)

    let message = `${prettyProvider} database${credentials.database ? ` ${credentials.database} ` : ' '}created`
    const dbLocation = getDbLocation(credentials)
    if (dbLocation) {
      message += ` at ${bold(dbLocation)}`
    }

    return message
  }

  return undefined
}

// returns the "host" like localhost / 127.0.0.1 + default port
export function getDbLocation(credentials: DatabaseCredentials): string | undefined {
  if (credentials.type === 'sqlite') {
    return credentials.uri!
  }

  const socket = getSocketFromDatabaseCredentials(credentials)

  if (socket) {
    return `unix:${socket}`
  }
  if (credentials.host && credentials.port) {
    return `${credentials.host}:${credentials.port}`
  }
  if (credentials.host) {
    return `${credentials.host}`
  }

  return undefined
}

/**
 * Return a pretty version of a "provider" (with uppercase characters)
 * @param provider
 * @returns PrettyProvider
 */
export function prettifyProvider(provider: ConnectorType): PrettyProvider {
  switch (provider) {
    case 'mysql':
      return 'MySQL'
    case 'postgres':
    case 'postgresql':
      return 'PostgreSQL'
    case PRISMA_POSTGRES_PROVIDER:
      return 'Prisma Postgres'
    case 'sqlite':
      return 'SQLite'
    case 'cockroachdb':
      return 'CockroachDB'
    case 'sqlserver':
      return 'SQL Server'
    case 'mongodb':
      return 'MongoDB'
  }
}
