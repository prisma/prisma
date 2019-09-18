import { DatabaseType } from 'prisma-datamodel'
import { URL } from 'url'

// code copied from @prisma/introspection
// don't touch this, but move it out into a separate dep, e.g. @prisma/cli or @prisma/sdk
export interface DatabaseCredentials {
  type: DatabaseType
  host?: string
  port?: number
  user?: string
  password?: string
  database?: string
  alreadyData?: boolean
  schema?: string
  newSchema?: string
  ssl?: boolean
  uri?: string
  executeRaw?: boolean
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
    ssl: uri.searchParams.has('sslmode'),
  }
}
