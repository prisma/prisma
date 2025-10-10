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

  // parse all parameters into an object, checking for duplicates
  const parameters: Record<string, string> = {}

  for (const part of paramParts) {
    const [key, value] = part.split('=', 2)
    if (!key) continue

    const trimmedKey = key.trim()
    if (trimmedKey in parameters) {
      throw new Error(`Duplication configuration parameter: ${trimmedKey}`)
    }
    parameters[trimmedKey] = value.trim()
    if (!handledParameters.includes(trimmedKey)) {
      debug(`Unknown connection string parameter: ${trimmedKey}`)
    }
  }

  const database = firstKey(parameters, 'database', 'initial catalog')
  if (database !== null) {
    config.database = database
  }

  const user = firstKey(parameters, 'user', 'username', 'uid', 'userid')
  if (user !== null) {
    config.user = user
  }

  const password = firstKey(parameters, 'password', 'pwd')
  if (password !== null) {
    config.password = password
  }

  const encrypt = firstKey(parameters, 'encrypt')
  if (encrypt !== null) {
    config.options = config.options || {}
    config.options.encrypt = encrypt.toLowerCase() === 'true'
  }

  const trustServerCertificate = firstKey(parameters, 'trustServerCertificate')
  if (trustServerCertificate !== null) {
    config.options = config.options || {}
    config.options.trustServerCertificate = trustServerCertificate.toLowerCase() === 'true'
  }

  const multiSubnetFailover = firstKey(parameters, 'multiSubnetFailover')
  if (multiSubnetFailover !== null) {
    config.options = config.options || {}
    config.options.multiSubnetFailover = multiSubnetFailover.toLowerCase() === 'true'
  }

  const connectionLimit = firstKey(parameters, 'connectionLimit')
  if (connectionLimit !== null) {
    config.pool = config.pool || {}
    const limit = parseInt(connectionLimit, 10)
    if (isNaN(limit)) {
      throw new Error(`Invalid connection limit: ${connectionLimit}`)
    }
    config.pool.max = limit
  }

  const connectionTimeout = firstKey(parameters, 'connectionTimeout', 'connectTimeout')
  if (connectionTimeout !== null) {
    const timeout = parseInt(connectionTimeout, 10)
    if (isNaN(timeout)) {
      throw new Error(`Invalid connection timeout: ${connectionTimeout}`)
    }
    config.connectionTimeout = timeout
  }

  const loginTimeout = firstKey(parameters, 'loginTimeout')
  if (loginTimeout !== null) {
    const timeout = parseInt(loginTimeout, 10)
    if (isNaN(timeout)) {
      throw new Error(`Invalid login timeout: ${loginTimeout}`)
    }
    config.connectionTimeout = timeout
  }

  const socketTimeout = firstKey(parameters, 'socketTimeout')
  if (socketTimeout !== null) {
    const timeout = parseInt(socketTimeout, 10)
    if (isNaN(timeout)) {
      throw new Error(`Invalid socket timeout: ${socketTimeout}`)
    }
    config.requestTimeout = timeout
  }

  const poolTimeout = firstKey(parameters, 'poolTimeout')
  if (poolTimeout !== null) {
    const timeout = parseInt(poolTimeout, 10)
    if (isNaN(timeout)) {
      throw new Error(`Invalid pool timeout: ${poolTimeout}`)
    }
    config.pool = config.pool || {}
    config.pool.acquireTimeoutMillis = timeout * 1000
  }

  const appName = firstKey(parameters, 'applicationName', 'application name')
  if (appName !== null) {
    config.options = config.options || {}
    config.options.appName = appName
  }

  const isolationLevel = firstKey(parameters, 'isolationLevel')
  if (isolationLevel !== null) {
    config.options = config.options || {}
    config.options.isolationLevel = mapIsolationLevelFromString(isolationLevel)
  }

  const authentication = firstKey(parameters, 'authentication')
  if (authentication !== null) {
    config.authentication = parseAuthenticationOptions(parameters, authentication)
  }

  if (!config.server || config.server.trim() === '') {
    throw new Error('Server host is required in connection string')
  }

  return config
}

/**
 * Parse all the authentication options, ensuring a valid configuration is provided
 * @param parameters configuration parameters
 * @param authenticationValue authentication string value
 */
function parseAuthenticationOptions(
  parameters: Record<string, string>,
  authenticationValue: string,
): sql.config['authentication'] | undefined {
  switch (authenticationValue) {
    /**
     * 'DefaultAzureCredential' is not listed in the JDBC driver spec
     * https://learn.microsoft.com/en-us/sql/connect/jdbc/setting-the-connection-properties?view=sql-server-ver15#properties
     * but is supported by tedious so included here
     */
    case 'DefaultAzureCredential':
    case 'ActiveDirectoryIntegrated':
    case 'ActiveDirectoryInteractive':
      // uses https://learn.microsoft.com/en-gb/azure/developer/javascript/sdk/authentication/credential-chains#use-defaultazurecredential-for-flexibility
      return { type: 'azure-active-directory-default', options: {} }
    case 'ActiveDirectoryPassword': {
      const userName = firstKey(parameters, 'userName')
      const password = firstKey(parameters, 'password')
      const clientId = firstKey(parameters, 'clientId')
      const tenantId = firstKey(parameters, 'tenantId')
      if (!userName || !password || !clientId) {
        throw new Error(`Invalid authentication, ActiveDirectoryPassword requires userName, password, clientId`)
      }
      return {
        type: 'azure-active-directory-password',
        options: {
          userName,
          password,
          clientId,
          tenantId: tenantId || '',
        },
      }
    }
    case 'ActiveDirectoryManagedIdentity':
    case 'ActiveDirectoryMSI': {
      const clientId = firstKey(parameters, 'clientId')
      const msiEndpoint = firstKey(parameters, 'msiEndpoint')
      const msiSecret = firstKey(parameters, 'msiSecret')
      if (!msiEndpoint || !msiSecret) {
        throw new Error(`Invalid authentication, ActiveDirectoryManagedIdentity requires msiEndpoint, msiSecret`)
      }
      return {
        type: 'azure-active-directory-msi-app-service',
        options: {
          clientId: clientId || undefined,
          // @ts-expect-error TODO: tedious typings don't define msiEndpoint and msiSecret -- needs to be fixed upstream
          msiEndpoint,
          msiSecret,
        },
      }
    }
    case 'ActiveDirectoryServicePrincipal': {
      const clientId = firstKey(parameters, 'userName')
      const clientSecret = firstKey(parameters, 'password')
      const tenantId = firstKey(parameters, 'tenantId')
      if (clientId && clientSecret) {
        return {
          type: 'azure-active-directory-service-principal-secret',
          options: {
            clientId,
            clientSecret,
            tenantId: tenantId || '',
          },
        }
      } else {
        throw new Error(
          `Invalid authentication, ActiveDirectoryServicePrincipal requires userName (clientId), password (clientSecret)`,
        )
      }
    }
  }
  return undefined
}

/**
 * Return the value of the first key found in the parameters object
 * @param parameters
 * @param keys
 */
function firstKey(parameters: Record<string, string>, ...keys: string[]): string | null {
  for (const key of keys) {
    if (key in parameters) {
      return parameters[key]
    }
  }
  return null
}

const handledParameters = [
  'application name',
  'applicationName',
  'connectTimeout',
  'connectionLimit',
  'connectionTimeout',
  'database',
  'encrypt',
  'initial catalog',
  'isolationLevel',
  'loginTimeout',
  'multiSubnetFailover',
  'password',
  'poolTimeout',
  'pwd',
  'socketTimeout',
  'trustServerCertificate',
  'uid',
  'user',
  'userid',
  'username',
]
