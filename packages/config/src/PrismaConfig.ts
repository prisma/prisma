import type { DriverAdapter as QueryableDriverAdapter } from '@prisma/driver-adapter-utils'

export type PrismaConfig<Env = any> = {
  /**
   * Whether experimental features are enabled.
   */
  experimental: true
  /**
   * The path from where the config was loaded. `null` if no config file was found and only default config is applied.
   */
  loadedFromFile: string | null
  /**
   * The configuration for Prisma Studio.
   */
  studio?: {
    /**
     * Istantiates the Prisma driver adapter to use for Prisma Studio.
     */
    createAdapter: (env: Env) => Promise<QueryableDriverAdapter>
  }
}
