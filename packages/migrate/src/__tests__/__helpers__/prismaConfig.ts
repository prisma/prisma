import { defineConfig, PrismaConfigInternal } from '@prisma/config'
import { PrismaMigrateConfigShape } from '@prisma/config/src/PrismaConfig'
import type { BaseContext } from '@prisma/get-platform'

import driverAdapters, { currentDriverAdapterName } from './driverAdapters'

/**
 * Extends a jestContext with a `config` property that is initialized with the default PrismaConfig and possibly a driver adapter.
 * Use with jestContext e.g. via `const ctx = jestContext.new().add(configContextContributor()).assemble()`
 */
export const configContextContributor =
  <C extends BaseContext>() =>
  (c: C) => {
    const ctx = c as C & { config: PrismaConfigInternal<any> }

    beforeEach(() => {
      ctx.config = defaultTestConfig<any>(ctx)
    })

    return ctx
  }

/**
 * Creates a default PrismaConfig with a driver adapter if the test are run with a driver adapter.
 */
export function defaultTestConfig<Env extends Record<string, string | undefined> = never>(
  ctx: BaseContext,
): PrismaConfigInternal<Env> {
  let migrate: PrismaMigrateConfigShape<Env> | undefined

  const adapterName = currentDriverAdapterName()
  if (adapterName) {
    const { adapter } = driverAdapters[adapterName]
    if (!adapter) {
      throw new Error(`Driver Adapter ${adapterName} not found`)
    }
    migrate = { adapter: adapter(ctx) }
  }

  return defineConfig({
    earlyAccess: true,
    migrate,
  })
}
