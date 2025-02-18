import type { DeepMutable } from 'effect/Types'

import { createPrismaConfigInternalShape, type PrismaConfigInternal } from './PrismaConfig'

/**
 * This default config can be used as basis for unit and integration tests.
 */
export function defaultTestConfig(): DeepMutable<PrismaConfigInternal> {
  return createPrismaConfigInternalShape().make({
    earlyAccess: true,
    loadedFromFile: null,
  })
}
