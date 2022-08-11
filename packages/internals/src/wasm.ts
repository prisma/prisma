import Debug from '@prisma/debug'
import _prismaFmt from '@prisma/prisma-fmt-wasm'
import { match } from 'ts-pattern'

import { getWASMVersion } from './engine-commands/getEngineVersion'
import { BinaryType } from './resolveBinary'

const debug = Debug('prisma:wasm')

/**
 * Re-exports Prisma WASM modules with an overridden `version()` method that returns the npm/hash version of the given WASM engine.
 */

export const prismaFmt = new Proxy(_prismaFmt, {
  get(target, prop) {
    return match(prop)
      .with('version', () => () => {
        const engineName = 'prisma-fmt-wasm'
        debug(`[${engineName}] original version is "${target[prop]()}"`)
        const overriddenVersion = getWASMVersion(BinaryType.prismaFmt)
        debug(`[${engineName}] overridden version is "${overriddenVersion}"`)
        return overriddenVersion
      })
      .otherwise(() => target[prop])
  },
})
