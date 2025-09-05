import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaMariaDb } from '@prisma/adapter-mariadb'
import { PrismaMssql } from '@prisma/adapter-mssql'
import type { SqlDriverAdapterFactory } from '@prisma/driver-adapter-utils'

export function createAdapter(url: string): SqlDriverAdapterFactory {
  if (url.startsWith('postgres://') || url.startsWith('postgresql://')) {
    return new PrismaPg({
      connectionString: url,
    })
  } else if (url.startsWith('mysql://') || url.startsWith('mariadb://')) {
    return new PrismaMariaDb(url)
  } else if (url.startsWith('sqlserver://')) {
    return new PrismaMssql(url)
  } else {
    let urlObj: URL
    try {
      urlObj = new URL(url)
    } catch {
      throw new Error('Invalid database URL')
    }
    throw new Error(`Unsupported protocol in database URL: ${urlObj.protocol}`)
  }
}
