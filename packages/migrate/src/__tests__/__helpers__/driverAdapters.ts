import { PrismaLibSQL } from '@prisma/adapter-libsql'
import {
  OfficialDriverAdapterName,
  Provider,
  SqlMigrationAwareDriverAdapterFactory,
} from '@prisma/driver-adapter-utils'
import { BaseContext } from '@prisma/get-platform'
import path from 'path'

export type DriverAdapterName = {
  [K in OfficialDriverAdapterName]: K extends `@prisma/adapter-${infer Name}` ? Name : never
}[OfficialDriverAdapterName] & {}

type DriverAdapterTestConfig = {
  provider: Provider
  adapter: (ctx: BaseContext) => () => Promise<SqlMigrationAwareDriverAdapterFactory>
}

const driverAdapters: Record<string, DriverAdapterTestConfig> = {
  libsql: {
    provider: 'sqlite',
    adapter: (ctx: BaseContext) => () => {
      const url = 'file:' + path.join(ctx.tmpDir, 'dev.db')
      return Promise.resolve(
        new PrismaLibSQL({
          url,
        }),
      )
    },
  },
}

export function currentDriverAdapterName(): DriverAdapterName | undefined {
  const adapterName = process.env.PRISMA_MIGRATE_TEST_ADAPTER

  if (!adapterName) return undefined

  if (driverAdapters[adapterName] === undefined) {
    throw new Error(`Config for driver adapter ${adapterName} not found`)
  }

  return adapterName as DriverAdapterName
}

export function providerOfCurrentDriverAdapter(): Provider {
  const adapterName = currentDriverAdapterName()
  if (adapterName === undefined) throw new Error('Test is not running for a specific driver adapter!')

  return driverAdapters[adapterName].provider
}

export default driverAdapters
