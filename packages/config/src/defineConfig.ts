import type { DriverAdapter as QueryableDriverAdapter } from '@prisma/driver-adapter-utils'
import { Debug } from '@prisma/driver-adapter-utils'
import type { DeepMutable } from 'effect/Types'

import { defaultConfig } from './defaultConfig'
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
   * The location of the Prisma schema file(s).
   */
  schema?: PrismaConfigInputSchemaSingle | PrismaConfigInputSchemaMulti
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
export function defineConfig<Env>(configInput: PrismaConfigInput<Env>): PrismaConfig<Env> {
  /**
   * We temporarily treat config as mutable, to simplify the implementation of this function.
   */
  const config = defaultConfig<Env>()

  defineSchemaConfig<Env>(config, configInput)
  debug('Prisma config [schema]: %o', config.schema)

  defineStudioConfig<Env>(config, configInput)
  debug('Prisma config [studio]: %o', config.studio)

  /**
   * We cast the type of `config` back to its original, deeply-nested
   * `Readonly` type
   */
  return config as PrismaConfig<Env>
}

function defineSchemaConfig<Env>(
  config: DeepMutable<PrismaConfig<Env>>,
  configInput: PrismaConfigInput<Env>,
) {
  if (!configInput.schema) {
    return
  }

  config.schema = configInput.schema
}

function defineStudioConfig<Env>(config: DeepMutable<PrismaConfig<Env>>, configInput: PrismaConfigInput<Env>) {
  if (!configInput.studio) {
    return
  }

  config.studio = {
    createAdapter: configInput.studio.adapter,
  }
}

type PrismaConfigInputSchemaSingle = {
  /**
   * Tell Prisma to use a single `.prisma` schema file.
   */
  kind: 'single'
  /**
   * The path to a single `.prisma` schema file.
   */
  filenamePath: string
}

type PrismaConfigInputSchemaMulti = {
  /**
   * Tell Prisma to use multiple `.prisma` schema files, via the `prismaSchemaFolder` preview feature.
   * Note: this doesn't check whether the `prismaSchemaFolder` preview feature is actually enabled.
   */
  kind: 'multi'
  /**
   * The path to a folder containing multiple `.prisma` schema files.
   * All of the files in this folder will be used.
   */
  folder: string
}
