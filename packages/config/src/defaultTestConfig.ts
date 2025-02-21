import type { DeepMutable } from 'effect/Types'

import { makePrismaConfigInternal, type PrismaConfigInternal } from './PrismaConfig'

/**
 * This default config can be used as basis for unit and integration tests.
 */
export function defaultTestConfig(): DeepMutable<PrismaConfigInternal> {
  return makePrismaConfigInternal({
    earlyAccess: true,
    loadedFromFile: null,
  })
}
