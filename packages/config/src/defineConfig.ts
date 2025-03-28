import { bindMigrationAwareSqlAdapterFactory, Debug } from '@prisma/driver-adapter-utils'
import type { DeepMutable } from 'effect/Types'

import { defaultConfig } from './defaultConfig'
import type { PrismaConfig, PrismaConfigInternal } from './PrismaConfig'

export type { PrismaConfigInternal }

const debug = Debug('prisma:config:defineConfig')

/**
 * Define the configuration for the Prisma Development Kit.
 */
export async function defineConfig<Env extends Record<string, string | undefined> = never>(
  configInput: PrismaConfig<Env>,
): Promise<PrismaConfigInternal> {
  /**
   * We temporarily treat config as mutable, to simplify the implementation of this function.
   */
  const config = defaultConfig()
  debug('[default]: %o', config)

  defineSchemaConfig<Env>(config, configInput)
  await defineStudioConfig<Env>(config, configInput)
  await defineMigrateConfig<Env>(config, configInput)

  /**
   * We cast the type of `config` back to its original, deeply-nested
   * `Readonly` type
   */
  return config as PrismaConfigInternal
}

function defineSchemaConfig<Env extends Record<string, string | undefined> = never>(
  config: DeepMutable<PrismaConfigInternal>,
  configInput: PrismaConfig<Env>,
) {
  if (!configInput.schema) {
    return
  }

  config.schema = configInput.schema
  debug('[config.schema]: %o', config.schema)
}

async function defineStudioConfig<Env extends Record<string, string | undefined> = never>(
  config: DeepMutable<PrismaConfigInternal>,
  configInput: PrismaConfig<Env>,
) {
  if (!configInput.studio) {
    return
  }

  debug('[config.studio]: %s', 'loading adapter')
  const adapterFactory = await configInput.studio.adapter(process.env as Env)
  const adapter = await adapterFactory.connect()

  config.studio = {
    adapter,
  }
  debug('[config.studio]: %o', config.studio)
}

async function defineMigrateConfig<Env extends Record<string, string | undefined> = never>(
  config: DeepMutable<PrismaConfigInternal>,
  configInput: PrismaConfig<Env>,
) {
  if (!configInput.migrate) {
    return
  }

  debug('[config.migrate]: %s', 'loading adapter')
  const adapter = await configInput.migrate.adapter(process.env as Env)

  config.migrate = {
    adapter: bindMigrationAwareSqlAdapterFactory(adapter),
  }
  debug('[config.migrate]: %o', config.migrate)
}
