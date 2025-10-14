import { PrismaLibSql } from '@prisma/driver-libsql'
import { OfficialDriverName, Provider, SqlMigrationAwareDriverFactory } from '@prisma/driver-utils'
import { BaseContext } from '@prisma/get-platform'
import path from 'path'

export type DriverName = {
  [K in OfficialDriverName]: K extends `@prisma/driver-${infer Name}` ? Name : never
}[OfficialDriverName] & {}

type DriverAdapterTestConfig = {
  provider: Provider
  driver: (ctx: BaseContext) => () => Promise<SqlMigrationAwareDriverFactory>
}

const driverAdapters: Record<string, DriverAdapterTestConfig> = {
  libsql: {
    provider: 'sqlite',
    driver: (ctx: BaseContext) => () => {
      const url = 'file:' + path.join(ctx.tmpDir, 'dev.db')
      return Promise.resolve(
        new PrismaLibSql({
          url,
        }),
      )
    },
  },
}

export function currentDriverAdapterName(): DriverName | undefined {
  const driverName = process.env.PRISMA_MIGRATE_TEST_ADAPTER

  if (!driverName) return undefined

  if (driverAdapters[driverName] === undefined) {
    throw new Error(`Config for driver ${driverName} not found`)
  }

  return driverName as DriverName
}

export function providerOfCurrentDriverAdapter(): Provider {
  const driverName = currentDriverAdapterName()
  if (driverName === undefined) throw new Error('Test is not running for a specific driver!')

  return driverAdapters[driverName].provider
}

export default driverAdapters
