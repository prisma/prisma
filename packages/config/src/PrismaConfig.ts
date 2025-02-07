import type { DriverAdapter as QueryableDriverAdapter} from '@prisma/driver-adapter-utils'

export type PrismaConfigEnvSkip = {
  /**
   * Don't load environment variables.
   */
  kind: 'skip'
}

export type PrismaConfigEnvLoad<Env = any> = {
  /**
   * Load environment variables using the provided function.
   */
  kind: 'load'
  /**
   * Loads the environment variables, returning them.
   */
  loadEnv: () => Promise<Env>
}

export type PrismaConfig<Env = any> = {
  /**
   * The environment-variable configuration strategy.
   */
  env: PrismaConfigEnvSkip | PrismaConfigEnvLoad<Env>
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
