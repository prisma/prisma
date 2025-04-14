import { PrismaLibSQL } from '@prisma/adapter-libsql'
import {
  OfficialDriverAdapterName,
  Provider,
  SqlMigrationAwareDriverAdapterFactory,
} from '@prisma/driver-adapter-utils'

export type DriverAdapterName = {
  [K in OfficialDriverAdapterName]: K extends `@prisma/adapter-${infer Name}` ? Name : never
}[OfficialDriverAdapterName]

type DriverAdapterTestConfig = {
  provider: Provider
  adapter: () => Promise<SqlMigrationAwareDriverAdapterFactory>
}

const driverAdapters: Record<string, DriverAdapterTestConfig> = {
  libsql: {
    provider: 'sqlite',
    adapter: () => {
      return Promise.resolve(
        new PrismaLibSQL({
          url: process.env.DATABASE_URL!,
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

export function currentProvider(): Provider | undefined {
  const adapterName = currentDriverAdapterName()
  if (adapterName === undefined) return undefined

  return driverAdapters[adapterName].provider
}

export default driverAdapters
