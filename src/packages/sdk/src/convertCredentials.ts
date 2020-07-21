import { DatabaseCredentials } from './types'
import URL from 'url-parse'
import { ConnectorType } from '@prisma/generator-helper'
import path from 'path'

export function credentialsToUri(credentials: DatabaseCredentials): string {
  const type = databaseTypeToProtocol(credentials.type)
  if (credentials.type === 'mongo') {
    return credentials.uri!
  }
  const url = new URL(type + '//', true)

  if (credentials.host) {
    url.hostname = credentials.host
  }

  if (credentials.type === 'postgresql') {
    if (credentials.database) {
      url.pathname = '/' + credentials.database
    }

    if (credentials.schema) {
      url.query.schema = credentials.schema
    }

    if (credentials.socket) {
      url.query.host = credentials.socket
    }
  } else if (credentials.type === 'mysql') {
    url.pathname = '/' + (credentials.database || credentials.schema || '')
    if (credentials.socket) {
      url.query.socket = credentials.socket
    }
  }

  if (credentials.ssl) {
    url.query.sslmode = 'prefer'
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

  url.host = `${url.hostname}${url.port ? `:${url.port}` : ''}`

  if (credentials.extraFields) {
    for (const [key, value] of Object.entries(credentials.extraFields)) {
      url.query[key] = value
    }
  }

  // trim away empty pathnames
  if (url.pathname === '/') {
    url.pathname = ''
  }

  if (credentials.type === 'sqlite') {
    // if `file:../parent-dev.db` return as it is
    return credentials.uri!
  }
  // use a custom toString method, as we don't want escaping of query params
  return url.toString((q) =>
    Object.entries(q)
      .map(([key, value]) => `${key}=${value}`)
      .join('&'),
  )
}

export function uriToCredentials(
  connectionString: string,
): DatabaseCredentials {
  const uri = new URL(connectionString, true)
  const type = protocolToDatabaseType(uri.protocol)

  // needed, as the URL implementation adds empty strings
  const exists = (str): boolean => str && str.length > 0

  if (type === 'mongo') {
    return {
      type,
      uri: connectionString, // todo: set authsource as database if not provided explicitly
    }
  }

  const { schema, socket, host, ...extraFields } = uri.query

  let database: string | undefined = undefined
  if (type === 'sqlite' && uri.pathname) {
    if (uri.pathname.startsWith('file:')) {
      database = uri.pathname.slice(5)
    }
    if (uri.pathname.startsWith('sqlite:')) {
      database = uri.pathname.slice(7)
    } else {
      database = path.basename(uri.pathname)
    }
  } else if (uri.pathname.length > 1) {
    database = uri.pathname.slice(1)
  }

  return {
    type,
    host: exists(uri.hostname) ? uri.hostname : undefined,
    user: exists(uri.username) ? uri.username : undefined,
    port: exists(uri.port) ? Number(uri.port) : undefined,
    password: exists(uri.password) ? uri.password : undefined,
    database,
    schema: uri.query.schema || undefined,
    uri: connectionString,
    ssl: Boolean(uri.query.sslmode),
    socket: uri.query.socket || uri.query.host,
    extraFields,
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
