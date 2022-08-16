import _prismaFmt from '@prisma/prisma-fmt-wasm'
import { match } from 'ts-pattern'

import { getWASMVersion } from './engine-commands/getEngineVersion'
import { BinaryType } from './resolveBinary'

/**
 * Re-exports Prisma WASM modules with an overridden `version()` method that returns the npm/hash version of the given WASM engine.
 */

export const prismaFmt = new Proxy(_prismaFmt, {
  get(target, prop) {
    return match(prop)
      .with('version', () => () => {
        const overriddenVersion = getWASMVersion(BinaryType.prismaFmt)
        return overriddenVersion
      })
      .otherwise(() => target[prop])
  },
})
