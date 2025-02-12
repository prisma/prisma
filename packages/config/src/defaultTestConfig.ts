import type { DeepMutable } from 'effect/Types'

import type { PrismaConfig } from './PrismaConfig'

/**
 * This default config can be used as basis for unit and integration tests.
 */
export function defaultTestConfig<Env = any>(): DeepMutable<PrismaConfig<Env>> {
  return {
    earlyAccess: true,
    loadedFromFile: null,
  }
}
