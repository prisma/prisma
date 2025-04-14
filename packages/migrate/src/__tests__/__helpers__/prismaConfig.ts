import { defineConfig, PrismaConfigInternal } from '@prisma/config'
import { PrismaMigrateConfigShape } from '@prisma/config/src/PrismaConfig'

import driverAdapters, { currentDriverAdapterName } from './driverAdapters'

export function defaultTestConfig<Env extends Record<string, string | undefined> = never>(): PrismaConfigInternal<Env> {
  let migrate: PrismaMigrateConfigShape<Env> | undefined

  const adapterName = currentDriverAdapterName()
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
