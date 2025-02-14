import type { DeepMutable } from 'effect/Types'

import { createPrismaConfigInternalShape, type PrismaConfigInternal } from './PrismaConfig'

/**
 * All default values for the config shall be set here.
 * Modules should not have to deal with missing config values and determining a default themselves as far as possible.
 * => Consistent defaults and centralized top-level control of configuration via the CLI.
 */
export function defaultConfig<Env = any>(): DeepMutable<PrismaConfigInternal<Env>> {
  return createPrismaConfigInternalShape<Env>().make({
    earlyAccess: true,
    loadedFromFile: null,
  })
}
