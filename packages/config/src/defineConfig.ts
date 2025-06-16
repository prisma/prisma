import { bindMigrationAwareSqlAdapterFactory, Debug } from '@prisma/driver-adapter-utils'
import type { DeepMutable } from 'effect/Types'

import { defaultConfig } from './defaultConfig'
import type { PrismaConfig, PrismaConfigInternal } from './PrismaConfig'

export type { PrismaConfigInternal }

const debug = Debug('prisma:config:defineConfig')

/**
 * Define the configuration for the Prisma Development Kit.
 */
export function defineConfig<Env extends Record<string, string | undefined> = never>(
  configInput: PrismaConfig<Env>,
): PrismaConfigInternal<Env> {
  /**
   * We temporarily treat config as mutable, to simplify the implementation of this function.
   */
  const config = defaultConfig<Env>()
  debug('[default]: %o', config)

  defineSchemaConfig<Env>(config, configInput)
  defineStudioConfig<Env>(config, configInput)
  defineMigrateConfig<Env>(config, configInput)

  /**
   * We cast the type of `config` back to its original, deeply-nested
   * `Readonly` type
   */
  return config as PrismaConfigInternal<Env>
}

/**
 * `configInput.schema` is forwarded to `config.schema` as is.
 */
function defineSchemaConfig<Env extends Record<string, string | undefined> = never>(
  config: DeepMutable<PrismaConfigInternal<Env>>,
  configInput: PrismaConfig<Env>,
) {
  if (!configInput.schema) {
    return
  }

  config.schema = configInput.schema
  debug('[config.schema]: %o', config.schema)
}

/**
 * `configInput.studio` is forwarded to `config.studio` as is.
 */
function defineStudioConfig<Env extends Record<string, string | undefined> = never>(
  config: DeepMutable<PrismaConfigInternal<Env>>,
  configInput: PrismaConfig<Env>,
) {
  if (!configInput.studio) {
    return
  }

  const { adapter: getAdapterFactory } = configInput.studio

  config.studio = {
    adapter: async (env) => {
      const adapterFactory = await getAdapterFactory(env)
      debug('[config.studio.adapter]: %o', adapterFactory.adapterName)
      return adapterFactory
    },
  }
  debug('[config.studio]: %o', config.studio)
}

/**
 * For `config.migrate`, we internally retrieve the `ErrorCapturingSqlMigrationAwareDriverAdapterFactory`
 * instance from the `SqlMigrationAwareDriverAdapterFactory` retrieved after invoking `configInput.migrate.adapter()`.
 */
function defineMigrateConfig<Env extends Record<string, string | undefined> = never>(
  config: DeepMutable<PrismaConfigInternal<Env>>,
  configInput: PrismaConfig<Env>,
) {
  if (!configInput.migrate) {
    return
  }

  const { adapter: getAdapterFactory } = configInput.migrate

  config.migrate = {
    ...configInput.migrate,
    adapter: getAdapterFactory
      ? async (env) => {
          const adapterFactory = await getAdapterFactory(env)
          debug('[config.migrate.adapter]: %o', adapterFactory.adapterName)
          return bindMigrationAwareSqlAdapterFactory(adapterFactory)
        }
      : undefined,
  }
  debug('[config.schema]: %o', config.migrate)
}
