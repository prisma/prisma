import { defineConfig, PrismaConfigInternal } from '@prisma/config'
import { PrismaMigrateConfigShape } from '@prisma/config/src/PrismaConfig'

import driverAdapters from './driverAdapters'

export function defaultTestConfig<Env extends Record<string, string | undefined> = never>(): PrismaConfigInternal<Env> {
  let migrate: PrismaMigrateConfigShape<Env> | undefined

  const adapterName = process.env.PRISMA_MIGRATE_TEST_ADAPTER
  if (adapterName) {
    const { adapter } = driverAdapters[adapterName]
    if (!adapter) {
      throw new Error(`Driver Adapter ${adapterName} not found`)
    }
    migrate = { adapter }
  }

  return defineConfig({
    earlyAccess: true,
    migrate,
  })
}
