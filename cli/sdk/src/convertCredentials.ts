import { DatabaseCredentials } from './types'
import { URL } from 'url'
import { ConnectorType } from '@prisma/generator-helper'

export function credentialsToUri(credentials: DatabaseCredentials): string {
  const type = databaseTypeToProtocol(credentials.type)
  if (credentials.type === 'mongo') {
    return credentials.uri!
  }
  const url = new URL(type + '//')

  if (credentials.host) {
    url.hostname = credentials.host
  }

  if (credentials.type === 'postgresql') {
    if (credentials.database) {
      url.pathname = '/' + credentials.database
    }

    if (credentials.schema) {
      url.searchParams.set('schema', credentials.schema)
    }
  } else if (credentials.type === 'mysql') {
    url.pathname = '/' + (credentials.database || credentials.schema || '')
  }

  if (credentials.ssl) {
    url.searchParams.set('sslmode', 'prefer')
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

export function uriToCredentials(
  connectionString: string,
): DatabaseCredentials {
  const uri = new URL(connectionString)
  const type = protocolToDatabaseType(uri.protocol)

  // needed, as the URL implementation adds empty strings
  const exists = str => str && str.length > 0

  if (type === 'mongo') {
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
    database:
      uri.pathname && uri.pathname.length > 1
        ? uri.pathname.slice(1)
        : undefined,
    schema: uri.searchParams.get('schema') || undefined,
    uri: connectionString,
    ssl: uri.searchParams.has('sslmode'),
  }
}

function databaseTypeToProtocol(databaseType: ConnectorType): string {
  switch (databaseType) {
    case 'postgresql':
      return 'postgresql:'
    case 'mysql':
      return 'mysql:'
    case 'mongo':
      return 'mongodb:'
    case 'sqlite':
      return 'sqlite:'
  }
}

function protocolToDatabaseType(protocol: string): ConnectorType {
  switch (protocol) {
    case 'postgresql:':
    case 'postgres:':
      return 'postgresql'
    case 'mongodb:':
      return 'mongo'
    case 'mysql:':
      return 'mysql'
    case 'file:':
    case 'sqlite:':
      return 'sqlite'
  }

  throw new Error(`Unknown database type ${protocol}`)
}

export function databaseTypeToConnectorType(
  databaseType: ConnectorType,
): ConnectorType {
  switch (databaseType) {
    case 'postgresql':
      return 'postgresql'
    case 'mysql':
      return 'mysql'
    case 'sqlite':
      return 'sqlite'
  }

  throw new Error(`Mongo is not yet supported`)
}
