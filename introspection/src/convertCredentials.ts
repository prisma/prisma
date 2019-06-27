import { DatabaseCredentials } from './types'
import { DatabaseType } from 'prisma-datamodel'
import { URL } from 'url'
import { ConnectorType } from '@prisma/lift'

export function credentialsToUri(credentials: DatabaseCredentials): string {
  const type = databaseTypeToProtocol(credentials.type)
  if (credentials.type === DatabaseType.mongo) {
    return credentials.uri!
  }
  const url = new URL(type + '//')

  if (credentials.host) {
    url.hostname = credentials.host
  }

  if (credentials.type === DatabaseType.postgres) {
    if (credentials.database) {
      url.pathname = '/' + credentials.database
    }

    if (credentials.schema) {
      url.searchParams.set('schema', credentials.schema)
    }
  } else if (credentials.type === DatabaseType.mysql) {
    url.pathname = '/' + (credentials.database || credentials.schema || '')
  }

  if (credentials.user) {
    url.username = credentials.user
  }

  if (credentials.password) {
    url.password = credentials.password
  }

  if (credentials.port) {
    url.port = String(credentials.port)
  }

  return url.toString()
}

export function uriToCredentials(connectionString: string): DatabaseCredentials {
  const uri = new URL(connectionString)
  const type = protocolToDatabaseType(uri.protocol)

  // needed, as the URL implementation adds empty strings
  const exists = str => str && str.length > 0

  if (type === DatabaseType.mongo) {
    return {
      type,
      uri: connectionString, // todo: set authsource as database if not provided explicitly
    }
  }

  return {
    type,
    host: exists(uri.hostname) ? uri.hostname : undefined,
    user: exists(uri.username) ? uri.username : undefined,
    port: exists(uri.port) ? Number(uri.port) : undefined,
    password: exists(uri.password) ? uri.password : undefined,
    database: uri.pathname && uri.pathname.length > 1 ? uri.pathname.slice(1) : undefined,
    schema: uri.searchParams.get('schema') || undefined,
    uri: connectionString,
  }
}

function databaseTypeToProtocol(databaseType: DatabaseType): string {
  switch (databaseType) {
    case DatabaseType.postgres:
      return 'postgresql:'
    case DatabaseType.mysql:
      return 'mysql:'
    case DatabaseType.mongo:
      return 'mongodb:'
    case DatabaseType.sqlite:
      return 'sqlite:'
  }
}

function protocolToDatabaseType(protocol: string): DatabaseType {
  switch (protocol) {
    case 'postgresql:':
      return DatabaseType.postgres
    case 'mongodb:':
      return DatabaseType.mongo
    case 'mysql:':
      return DatabaseType.mysql
    case 'file:':
    case 'sqlite:':
      return DatabaseType.sqlite
  }

  throw new Error(`Unknown database type ${protocol}`)
}

export function databaseTypeToConnectorType(databaseType: DatabaseType): ConnectorType {
  switch (databaseType) {
    case DatabaseType.postgres:
      return 'postgres'
    case DatabaseType.mysql:
      return 'mysql'
    case DatabaseType.sqlite:
      return 'sqlite'
  }
  throw new Error(`Mongo is not yet supported`)
}
