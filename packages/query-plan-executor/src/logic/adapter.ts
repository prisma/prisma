import { PrismaMariaDb } from '@prisma/driver-mariadb'
import { PrismaMssql } from '@prisma/driver-mssql'
import { PrismaPg } from '@prisma/driver-pg'
import type { SqlDriverFactory } from '@prisma/driver-utils'

export function createAdapter(url: string): SqlDriverFactory {
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
  create: (url: string) => SqlDriverFactory
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
