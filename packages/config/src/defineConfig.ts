import type { SqlConnection as QueryableDriverAdapter } from '@prisma/driver-adapter-utils'
import { Debug } from '@prisma/driver-adapter-utils'

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
  experimental: true
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
  const config: PrismaConfig<Env> = {
    // Currently, every feature is considered experimental.
    experimental: true,
    loadedFromFile: null, // will be overwritten after loading the config file from disk
  }

  if (configInput.studio) {
    config.studio = {
      createAdapter: configInput.studio.adapter,
    }

    debug('Prisma config [studio]: %o', config.studio)
  }

  return config
}
