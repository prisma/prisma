import type { DatabaseCredentials } from './types'
import * as NodeURL from 'url'
import type { ConnectorType } from '@prisma/generator-helper'
import path from 'path'

export function credentialsToUri(credentials: DatabaseCredentials): string {
  const type = databaseTypeToProtocol(credentials.type)
  if (credentials.type === 'mongodb') {
    return credentials.uri!
  }
  const url = new NodeURL.URL(type + '//')

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

    if (credentials.socket) {
      url.host = credentials.socket
    }
  } else if (credentials.type === 'mysql') {
    url.pathname = '/' + (credentials.database || credentials.schema || '')
    if (credentials.socket) {
      url.searchParams.set('socket', credentials.socket)
    }
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

  url.host = `${url.hostname}${url.port ? `:${url.port}` : ''}`

  if (credentials.extraFields) {
    for (const [key, value] of Object.entries(credentials.extraFields)) {
      url.searchParams.set(key, value)
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

  return url.toString()
}

export function uriToCredentials(
  connectionString: string,
): DatabaseCredentials {
  let uri: NodeURL.URL
  try {
    uri = new NodeURL.URL(connectionString)
  } catch (e) {
    throw new Error(
      'Invalid data source URL, see https://www.prisma.io/docs/reference/database-reference/connection-urls',
    )
  }

  const type = protocolToConnectorType(uri.protocol)

  // needed, as the URL implementation adds empty strings
  const exists = (str): boolean => str && str.length > 0

  if (type === 'mongodb') {
    return {
      type,
      uri: connectionString, // todo: set authsource as database if not provided explicitly
    }
  }

  const extraFields = {}
  const schema = uri.searchParams.get('schema')
  const socket = uri.searchParams.get('socket')

  for (const [name, value] of uri.searchParams) {
    if (!['schema', 'socket'].includes(name)) {
      extraFields[name] = value
    }
  }

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
    ssl: Boolean(uri.searchParams.get('sslmode')),
    socket: socket || undefined,
    extraFields,
  }
}

function databaseTypeToProtocol(databaseType: ConnectorType): string {
  switch (databaseType) {
    case 'postgresql':
      return 'postgresql:'
    case 'mysql':
      return 'mysql:'
    case 'mongodb':
      return 'mongodb:'
    case 'sqlite':
      return 'sqlite:'
    case 'sqlserver':
      return 'sqlserver:'
  }
}

export function protocolToConnectorType(protocol: string): ConnectorType {
  switch (protocol) {
    case 'postgresql:':
    case 'postgres:':
      return 'postgresql'
    case 'mongodb+srv:':
    case 'mongodb:':
      return 'mongodb'
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
