import { defineConfig, PrismaConfigInternal } from '@prisma/config'
import { SqlMigrationAwareDriverFactoryShape } from '@prisma/config/src/PrismaConfig'
import type { BaseContext } from '@prisma/get-platform'

import driverAdapters, { currentDriverAdapterName } from './driverAdapters'

type ConfigContext = {
  config: () => Promise<PrismaConfigInternal>
}

/**
 * Extends a jestContext with a function to get a PrismaConfig.
 * The config includes a configured migrate driver based on the current test matrix.
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
 * Creates a PrismaConfig with a driver if the test are run with a driver.
 * If a prisma.config.ts file exists, it will be merged with the default config.
 */
function defaultTestConfig(ctx: BaseContext): PrismaConfigInternal {
  let driver: SqlMigrationAwareDriverFactoryShape | undefined

  const driverName = currentDriverAdapterName()
  if (driverName) {
    const { driver: createAdapter } = driverAdapters[driverName]
    if (!createAdapter) {
      throw new Error(`Driver Adapter ${driverName} not found`)
    }
    driver = createAdapter(ctx)
  }

  return defineConfig({
    experimental: {
      driver: driver !== undefined,
    },
    driver,
  })
}

async function loadFixtureConfig(ctx: BaseContext) {
  // Note: This is a workaround to avoid issues with jest's module resolution.
  // If you used `loadConfigFromFile` directly, you'd observe the following error:
  // ```
  // [ERR_VM_DYNAMIC_IMPORT_CALLBACK_MISSING_FLAG]: A dynamic import callback was invoked without --experimental-vm-modules
  // ```
  if (!ctx.fs.exists(`${ctx.fs.cwd()}/prisma.config.ts`)) return undefined
  return (await import(`${ctx.fs.cwd()}/prisma.config.ts`)).default as PrismaConfigInternal
}
