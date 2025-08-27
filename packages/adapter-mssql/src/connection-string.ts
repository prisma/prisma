import { Debug } from '@prisma/driver-adapter-utils'
import sql from 'mssql'

/**
 * Maps isolation level string from connection string to mssql isolation level number.
 * Analog to quaint: https://github.com/prisma/prisma-engines/blob/main/quaint/src/connector/transaction.rs
 */
function mapIsolationLevelFromString(level: string): number {
  const normalizedLevel = level.toUpperCase().replace(/\s+/g, '')

  switch (normalizedLevel) {
    case 'READCOMMITTED':
      return sql.ISOLATION_LEVEL.READ_COMMITTED
    case 'READUNCOMMITTED':
      return sql.ISOLATION_LEVEL.READ_UNCOMMITTED
    case 'REPEATABLEREAD':
      return sql.ISOLATION_LEVEL.REPEATABLE_READ
    case 'SERIALIZABLE':
      return sql.ISOLATION_LEVEL.SERIALIZABLE
    case 'SNAPSHOT':
      return sql.ISOLATION_LEVEL.SNAPSHOT
    default:
      throw new Error(`Invalid isolation level: ${level}`)
  }
}

const debug = Debug('prisma:driver-adapter:mssql:connection-string')

/**
 * Extracts the schema parameter from a connection string.
 * @param connectionString The connection string.
 * @returns The schema value or undefined if not found.
 */
export function extractSchemaFromConnectionString(connectionString: string): string | undefined {
  const withoutProtocol = connectionString.replace(/^sqlserver:\/\//, '')
  const parts = withoutProtocol.split(';')

  for (const part of parts) {
    const [key, value] = part.split('=', 2)
    if (key?.trim() === 'schema') {
      return value?.trim()
    }
  }
  return undefined
}

/**
 * Parses a Prisma SQL Server connection string into a sql.config object.
 * As per https://www.prisma.io/docs/orm/overview/databases/sql-server#connection-details.
 * @param connectionString The connection string.
 * @returns A sql.config object
 */
export function parseConnectionString(connectionString: string): sql.config {
  const withoutProtocol = connectionString.replace(/^sqlserver:\/\//, '')

  // Split by semicolon to get key-value pairs
  const [hostPart, ...paramParts] = withoutProtocol.split(';')

  const config: sql.config = {
    server: '',
    options: {},
    pool: {},
  }

  // Parse the first part which contains host and port
  const [host, portStr] = hostPart.split(':')
  config.server = host.trim()

  if (portStr) {
    const port = parseInt(portStr, 10)
    if (isNaN(port)) {
      throw new Error(`Invalid port number: ${portStr}`)
    }
    config.port = port
  }

  // Parse the remaining parameters
  for (const part of paramParts) {
    const [key, value] = part.split('=', 2)
    if (!key) continue

    const trimmedKey = key.trim()
    const trimmedValue = value.trim()

    switch (trimmedKey) {
      case 'database':
      case 'initial catalog':
        config.database = trimmedValue
        break
      case 'user':
      case 'username':
      case 'uid':
      case 'userid':
        config.user = trimmedValue
        break
      case 'password':
      case 'pwd':
        config.password = trimmedValue
        break
      case 'encrypt':
        config.options = config.options || {}
        config.options.encrypt = trimmedValue.toLowerCase() === 'true'
        break
      case 'trustServerCertificate':
        config.options = config.options || {}
        config.options.trustServerCertificate = trimmedValue.toLowerCase() === 'true'
        break
      case 'connectionLimit': {
        config.pool = config.pool || {}
        const limit = parseInt(trimmedValue, 10)
        if (isNaN(limit)) {
          throw new Error(`Invalid connection limit: ${trimmedValue}`)
        }
        config.pool.max = limit
        break
      }
      case 'connectTimeout':
      case 'connectionTimeout': {
        const connectTimeout = parseInt(trimmedValue, 10)
        if (isNaN(connectTimeout)) {
          throw new Error(`Invalid connection timeout: ${trimmedValue}`)
        }
        config.connectionTimeout = connectTimeout
        break
      }
      case 'loginTimeout': {
        const loginTimeout = parseInt(trimmedValue, 10)
        if (isNaN(loginTimeout)) {
          throw new Error(`Invalid login timeout: ${trimmedValue}`)
        }
        config.connectionTimeout = loginTimeout
        break
      }
      case 'socketTimeout': {
        const socketTimeout = parseInt(trimmedValue, 10)
        if (isNaN(socketTimeout)) {
          throw new Error(`Invalid socket timeout: ${trimmedValue}`)
        }
        config.requestTimeout = socketTimeout
        break
      }
      case 'poolTimeout': {
        const poolTimeout = parseInt(trimmedValue, 10)
        if (isNaN(poolTimeout)) {
          throw new Error(`Invalid pool timeout: ${trimmedValue}`)
        }
        config.pool = config.pool || {}
        config.pool.acquireTimeoutMillis = poolTimeout * 1000
        break
      }
      case 'applicationName':
      case 'application name':
        config.options = config.options || {}
        config.options.appName = trimmedValue
        break
      case 'isolationLevel':
        config.options = config.options || {}
        config.options.isolationLevel = mapIsolationLevelFromString(trimmedValue)
        break
      case 'schema':
        // This is handled separately in PrismaMssqlOptions
        break
      default:
        debug(`Unknown connection string parameter: ${trimmedKey}`)
    }
  }

  if (!config.server || config.server.trim() === '') {
    throw new Error('Server host is required in connection string')
  }

  return config
}
