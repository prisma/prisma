import type { DeepMutable } from 'effect/Types'

import { makePrismaConfigInternal, type PrismaConfigInternal } from './PrismaConfig'

/**
 * All default values for the config shall be set here.
 * Modules should not have to deal with missing config values and determining a default themselves as far as possible.
 * => Consistent defaults and centralized top-level control of configuration via the CLI.
 */
export function defaultConfig<Env extends Record<string, string | undefined> = never>(): DeepMutable<
  PrismaConfigInternal<Env>
> {
  return makePrismaConfigInternal<Env>({
    earlyAccess: true,
    loadedFromFile: null,
  })
}
