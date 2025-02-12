import type { DriverAdapter as QueryableDriverAdapter } from '@prisma/driver-adapter-utils'
import { Debug } from '@prisma/driver-adapter-utils'
import type { DeepMutable } from 'effect/Types'

import type { PrismaConfig } from './PrismaConfig'

export type { PrismaConfig }

const debug = Debug('prisma:config:defineConfig')

/**
 * Define the configuration for the Prisma Development Kit.
 */
export type PrismaConfigInput<Env> = {
  /**
   * Whether to enable experimental features.
   * Currently, every feature is considered experimental.
   */
  earlyAccess: true
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

export function defineConfig<Env>(configInput: PrismaConfigInput<Env>): PrismaConfig<Env> {
  /**
   * We temporarily cast the config to a mutable type, to simplify the implementation
   * of this function.
   */
  const config: DeepMutable<PrismaConfig<Env>> = {
    // Currently, every feature is considered experimental.
    earlyAccess: true,
    loadedFromFile: null, // will be overwritten after loading the config file from disk
  }

  if (configInput.studio) {
    config.studio = {
      createAdapter: configInput.studio.adapter,
    }

    debug('Prisma config [studio]: %o', config.studio)
  }

  /**
   * We cast the type of `config` back to its original, deeply-nested
   * `Readonly` type
   */
  return config as PrismaConfig<Env>
}
