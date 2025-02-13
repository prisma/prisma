import type { DeepMutable } from 'effect/Types'

import { createPrismaConfigInternalShape, type PrismaConfigInternal } from './PrismaConfig'

/**
 * This default config can be used as basis for unit and integration tests.
 */
export function defaultTestConfig<Env = any>(): DeepMutable<PrismaConfigInternal<Env>> {
  return createPrismaConfigInternalShape<Env>().make({
    earlyAccess: true,
    loadedFromFile: null,
  })
}
