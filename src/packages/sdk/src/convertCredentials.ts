import { DatabaseCredentials } from './types'
import URL from 'url-parse'
import { ConnectorType } from '@prisma/generator-helper'
import path from 'path'
import { JdbcString } from '@pimeys/connection-string'

export function credentialsToUri(credentials: DatabaseCredentials): string {
  const type = databaseTypeToProtocol(credentials.type)
  if (credentials.type === 'mongo') {
    return credentials.uri!
  } else if (credentials.type === 'sqlserver') {
    // editing the connectionString is not yet supported
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
  if (connectionString.startsWith('sqlserver')) {
    const j = new JdbcString(connectionString)

    let extraFields = {}
    if (j.get('encrypt')) {
      extraFields['encrypt'] = j.get('encrypt')
    }
    if (j.get('trustservercertificate')) {
      extraFields['trustservercertificate'] = j.get('trustservercertificate')
    }

    return {
      type: 'sqlserver',
      host: j.server_name(),
      user: j.get('user'),
      port: j.port(),
      password: j.get('password'),
      database: j.get('database'),
      schema: j.get('schema') || 'dbo',
      uri: connectionString,
      extraFields,
    }
  } else {
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
    let defaultSchema: string | undefined = undefined

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

      if (type === 'postgresql' && !database) {
        // use postgres as default, it's 99% accurate
        // could also be template1 for example in rare cases
        database = 'postgres'
      }
    }

    if (type === 'postgresql' && !schema) {
      // default to public schema
      defaultSchema = 'public'
    }

    return {
      type,
      host: exists(uri.hostname) ? uri.hostname : undefined,
      user: exists(uri.username) ? uri.username : undefined,
      port: exists(uri.port) ? Number(uri.port) : undefined,
      password: exists(uri.password) ? uri.password : undefined,
      database,
      schema: schema || defaultSchema,
      uri: connectionString,
      ssl: Boolean(uri.query.sslmode),
      socket: socket || host,
      extraFields,
    }
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
    case 'sqlserver':
      return 'sqlserver:'
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
    case 'sqlserver:':
    case 'jdbc:sqlserver:':
      return 'sqlserver'
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
    case 'sqlserver':
      return 'sqlserver'
  }

  throw new Error(`Mongo is not yet supported`)
}
