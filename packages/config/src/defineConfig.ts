import type { DriverAdapter as QueryableDriverAdapter } from '@prisma/driver-adapter-utils'
import { Debug } from '@prisma/driver-adapter-utils'
import type { DeepMutable } from 'effect/Types'

import { defaultConfig } from './defaultConfig'
import type { PrismaConfigInternal, PrismaSchemaConfigShape } from './PrismaConfig'

export type { PrismaConfigInternal }

const debug = Debug('prisma:config:defineConfig')

/**
 * Define the input configuration for the Prisma Development Kit.
 */
export type PrismaConfig<Env> = {
  /**
   * Whether to enable experimental features.
   * Currently, every feature is considered experimental.
   */
  earlyAccess: true
  /**
   * The location of the Prisma schema file(s).
   */
  schema?: PrismaSchemaConfigShape
  /**
   * The configuration for the Prisma Studio.
   */
  studio?: {
    /**
     * Istantiates the Prisma driver adapter to use for Prisma Studio.
     * @param env Dictionary of environment variables.
     * @returns The Prisma driver adapter to use for Prisma Studio.
     */
    adapter: (env: Env) => Promise<QueryableDriverAdapter>
  }
}

/**
 * Define the configuration for the Prisma Development Kit.
 */
export function defineConfig<Env>(configInput: PrismaConfig<Env>): PrismaConfigInternal<Env> {
  /**
   * We temporarily treat config as mutable, to simplify the implementation of this function.
   */
  const config = defaultConfig<Env>()

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
    createAdapter: configInput.studio.adapter,
  }
  debug('Prisma config [studio]: %o', config.studio)
}
