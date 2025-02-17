import { Debug } from '@prisma/driver-adapter-utils'
import type { DeepMutable } from 'effect/Types'

import { defaultConfig } from './defaultConfig'
import type { PrismaConfigInternal, PrismaSchemaConfigShape } from './PrismaConfig'

export type { PrismaConfigInternal }

const debug = Debug('prisma:config:defineConfig')

/**
 * Define the input configuration for the Prisma Development Kit.
 */
export type PrismaConfig = {
  /**
   * Whether to enable experimental features.
   * Currently, every feature is considered experimental.
   */
  earlyAccess: true
  /**
   * The location of the Prisma schema file(s).
   */
  schema?: PrismaSchemaConfigShape
}

/**
 * Define the configuration for the Prisma Development Kit.
 */
export function defineConfig(configInput: PrismaConfig): PrismaConfigInternal {
  /**
   * We temporarily treat config as mutable, to simplify the implementation of this function.
   */
  const config = defaultConfig()

  defineSchemaConfig(config, configInput)

  /**
   * We cast the type of `config` back to its original, deeply-nested
   * `Readonly` type
   */
  return config as PrismaConfigInternal
}

function defineSchemaConfig(
  config: DeepMutable<PrismaConfigInternal>,
  configInput: PrismaConfig,
) {
  if (!configInput.schema) {
    return
  }

  config.schema = configInput.schema
  debug('Prisma config [schema]: %o', config.schema)
}
