import { Debug } from '@prisma/driver-adapter-utils'
import type { DeepMutable } from 'effect/Types'

import { defaultConfig } from './defaultConfig'
import type { PrismaConfig, PrismaConfigInternal } from './PrismaConfig'

export type { PrismaConfigInternal }

const debug = Debug('prisma:config:defineConfig')

/**
 * Define the configuration for the Prisma Development Kit.
 */
export function defineConfig<Env>(configInput: PrismaConfig<Env>): PrismaConfigInternal<Env> {
  /**
   * We temporarily treat config as mutable, to simplify the implementation of this function.
   */
  const config = defaultConfig<Env>()
  debug('Prisma config [default]: %o', config)

  defineSchemaConfig<Env>(config, configInput)
  defineStudioConfig<Env>(config, configInput)

  /**
   * We cast the type of `config` back to its original, deeply-nested
   * `Readonly` type
   */
  return config as PrismaConfigInternal<Env>
}

function defineSchemaConfig<Env>(config: DeepMutable<PrismaConfigInternal<Env>>, configInput: PrismaConfig<Env>) {
  if (!configInput.schema) {
    return
  }

  config.schema = configInput.schema
  debug('Prisma config [schema]: %o', config.schema)
}

function defineStudioConfig<Env>(config: DeepMutable<PrismaConfigInternal<Env>>, configInput: PrismaConfig<Env>) {
  if (!configInput.studio) {
    return
  }

  config.studio = {
    adapter: configInput.studio.adapter,
  }
  debug('Prisma config [studio]: %o', config.studio)
}
