import type { DriverAdapter as QueryableDriverAdapter } from '@prisma/driver-adapter-utils'

export type PrismaConfig<Env = any> = {
  /**
   * Whether experimental features are enabled.
   */
  experimental: true
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
