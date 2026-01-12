import { PrismaMariaDb } from '@prisma/adapter-mariadb'
import { PrismaMssql } from '@prisma/adapter-mssql'
import { PrismaPg } from '@prisma/adapter-pg'
import type { SqlDriverAdapter, SqlDriverAdapterFactory, Transaction } from '@prisma/driver-adapter-utils'

export function createAdapter(url: string, supportedFactories: Factory[] = defaultFactories): SqlDriverAdapterFactory {
  for (const factory of supportedFactories) {
    if (factory.protocols.some((protocol) => url.startsWith(`${protocol}://`))) {
      return wrapFactory(factory.create(url))
    }
  }
  let urlObj: URL
  try {
    urlObj = new URL(url)
  } catch {
    throw new Error('Invalid database URL')
  }
  throw new Error(`Unsupported protocol in database URL: ${urlObj.protocol}`)
}

type Factory = {
  protocols: string[]
  create: (url: string) => SqlDriverAdapterFactory
}

const defaultFactories: Factory[] = [
  {
    protocols: ['postgres', 'postgresql'],
    create(connectionString) {
      const url = new URL(connectionString)

      if (['sslcert', 'sslkey', 'sslrootcert'].some((param) => url.searchParams.has(param))) {
        throw new Error(
          'Unsupported parameters in connection string: uploading and using custom TLS certificates is not currently supported',
        )
      }

      const sslmode = url.searchParams.get('sslmode')

      // Accept self-signed certificates with `sslmode=require` for backward compatibility with QE
      // and consistency with libpq. If certificate validation is desired, `sslmode` must be set
      // to `verify-ca` or `verify-full`.
      // Note that `sslmode=prefer` is still treated the same as `sslmode=require`. This is a
      // `node-postgres` quirk which is inconsistent with both QE and libpq. Unfortunately
      // there's currently no way to support `sslmode=prefer` properly with `node-postgres`.
      if (sslmode === 'prefer' || sslmode === 'require') {
        url.searchParams.set('sslmode', 'no-verify')
      }

      return new PrismaPg({ connectionString: url.toString() })
    },
  },

  {
    protocols: ['mysql', 'mariadb'],
    create(url) {
      return new PrismaMariaDb(url)
    },
  },

  {
    protocols: ['sqlserver'],
    create(url) {
      return new PrismaMssql(url)
    },
  },
]

const defaultSupportedProtocols = defaultFactories.flatMap((factory) => factory.protocols)

/**
 * Rethrows the given error after sanitizing its message by redacting
 * any connection strings found within it.
 */
function rethrowSanitizedError(error: unknown): never {
  if (typeof error === 'object' && error !== null) {
    sanitizeError(error, createConnectionStringRegex())
  }
  throw error
}

function sanitizeError(error: object, regex: RegExp, visited: WeakSet<object> = new WeakSet()) {
  if (visited.has(error)) {
    return
  }
  visited.add(error)

  for (const key of Object.getOwnPropertyNames(error)) {
    const value = error[key]
    if (typeof value === 'string') {
      error[key] = value.replaceAll(regex, '[REDACTED]')
    } else if (typeof value === 'object' && value !== null) {
      sanitizeError(value as object, regex, visited)
    }
  }
}

function createConnectionStringRegex() {
  const escapedProtocols = defaultSupportedProtocols.join('|')

  // A lenient regex to match connection strings in error messages.
  // It might match some false positives, but that's acceptable for errors in the QPE.
  // We do not want anything that looks like a connection string in the logs.
  const pattern = [
    `['"\`]?`, // Optional opening quote
    `(${escapedProtocols})`, // Protocol group
    `:\\/\\/`, // Protocol separator
    `[^\\s]+`, // Connection string body
    `['"\`]?`, // Optional closing quote
  ].join('')

  return new RegExp(pattern, 'gi')
}

function wrapFactory(factory: SqlDriverAdapterFactory): SqlDriverAdapterFactory {
  return {
    ...factory,
    connect: () => factory.connect().then(wrapAdapter, rethrowSanitizedError),
  }
}

function wrapAdapter(adapter: SqlDriverAdapter): SqlDriverAdapter {
  return {
    ...adapter,
    dispose: () => adapter.dispose().catch(rethrowSanitizedError),
    executeRaw: (query) => adapter.executeRaw(query).catch(rethrowSanitizedError),
    queryRaw: (query) => adapter.queryRaw(query).catch(rethrowSanitizedError),
    executeScript: (script) => adapter.executeScript(script).catch(rethrowSanitizedError),
    startTransaction: (isolationLevel) =>
      adapter.startTransaction(isolationLevel).then(wrapTransaction, rethrowSanitizedError),
  }
}

function wrapTransaction(tx: Transaction): Transaction {
  return {
    ...tx,
    commit: () => tx.commit().catch(rethrowSanitizedError),
    rollback: () => tx.rollback().catch(rethrowSanitizedError),
    executeRaw: (query) => tx.executeRaw(query).catch(rethrowSanitizedError),
    queryRaw: (query) => tx.queryRaw(query).catch(rethrowSanitizedError),
  }
}
