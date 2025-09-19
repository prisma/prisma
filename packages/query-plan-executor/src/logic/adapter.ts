import type { ConnectionOptions as TlsOptions } from 'node:tls'

import { PrismaMariaDb } from '@prisma/adapter-mariadb'
import { PrismaMssql } from '@prisma/adapter-mssql'
import { PrismaPg } from '@prisma/adapter-pg'
import type { SqlDriverAdapterFactory } from '@prisma/driver-adapter-utils'

export function createAdapter(url: string): SqlDriverAdapterFactory {
  for (const factory of factories) {
    if (factory.protocols.some((protocol) => url.startsWith(`${protocol}://`))) {
      return factory.create(url)
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

const factories: Factory[] = [
  {
    protocols: ['postgres', 'postgresql'],
    create(connectionString) {
      const url = new URL(connectionString)

      if (['sslcert', 'sslkey', 'sslrootcert'].some((param) => url.searchParams.has(param))) {
        throw new Error(
          'Unsupported parameters in connection string: uploading and using custom TLS certificates is not currently supported',
        )
      }

      let sslmode = url.searchParams.get('sslmode')

      // If `sslmode` is not set and `ssl=true`, treat it as `sslmode=require` for compatibility with JDBC URLs.
      // See https://www.postgresql.org/docs/18/libpq-connect.html#LIBPQ-CONNSTRING-URIS
      if (sslmode === null && url.searchParams.get('ssl') === 'true') {
        sslmode = 'require'
      }

      // Accept self-signed certificates with `sslmode=require` for backward compatibility with QE.
      // Other than this, the behaviour is identical to the defaults in `node-postgres`.
      // Notably, `sslmode=disable` by default because `node-postgres` doesn't really support
      // `sslmode=prefer` properly and treats it the same as `sslmode=require`.
      const ssl: TlsOptions | boolean = (() => {
        switch (sslmode) {
          case null:
          case 'disable':
            return false
          case 'prefer':
          case 'require':
          case 'no-verify':
            return { rejectUnauthorized: false }
          case 'verify-ca':
          case 'verify-full':
            return true
          default:
            throw new Error(`Unsupported sslmode: ${sslmode}`)
        }
      })()

      // The explicit `ssl` argument overrides TLS-related parameters in the connection string
      // so we don't need to edit the connection string ourselves.
      // See https://node-postgres.com/features/ssl#usage-with-connectionstring
      return new PrismaPg({ connectionString, ssl })
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
