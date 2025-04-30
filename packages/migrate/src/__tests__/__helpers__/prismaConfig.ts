import { defineConfig, loadConfigFromFile, PrismaConfigInternal } from '@prisma/config'
import { PrismaMigrateConfigShape } from '@prisma/config/src/PrismaConfig'
import type { BaseContext } from '@prisma/get-platform'

import driverAdapters, { currentDriverAdapterName } from './driverAdapters'

type ConfigContext = {
  config: () => Promise<PrismaConfigInternal<any>>
}

/**
 * Extends a jestContext with a function to get a PrismaConfig.
 * The config includes a configured migrate driver adapter based on the current test matrix.
 * Any prisma.config.ts file in the root of the test context fixture will be merged with the default config.
 * Use with jestContext e.g. via `const ctx = jestContext.new().add(configContextContributor()).assemble()`
 */
export const configContextContributor =
  <C extends BaseContext>() =>
  (c: C) => {
    const ctx = c as C & ConfigContext

    beforeEach(() => {
      ctx.config = async () => {
        return {
          ...defaultTestConfig(ctx),
          ...(await loadFixtureConfig(ctx)), // custom fixture config overwrites any defaults
        }
      }
    })

    return ctx
  }

/**
 * Creates a PrismaConfig with a driver adapter if the test are run with a driver adapter.
 * If a prisma.config.ts file exists, it will be merged with the default config.
 */
function defaultTestConfig<Env extends Record<string, string | undefined>>(
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

async function loadFixtureConfig(ctx: BaseContext) {
  return (await loadConfigFromFile({ configFile: 'prisma.config.ts', configRoot: ctx.fs.cwd() })).config
}
