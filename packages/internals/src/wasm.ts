import _prismaFmt from '@prisma/prisma-fmt-wasm'
import { match } from 'ts-pattern'

import { getWasmVersion } from './engine-commands/getEngineVersion'
import { BinaryType } from './resolveBinary'

/**
 * Re-exports Prisma Wasm modules with an overridden `version()` method that returns the npm/hash version of the given Wasm engine.
 *
 * Note: Proxies add a slight overhead to v8, and are not the fastest Node.js utility to work with.
 *
 * In case you need to optimize performance and speed up the access to Wasm engines, you might:
 * - export Wasm engines as they are
 * - use `getWasmVersion(BinaryType.*)` directly rather than invoking the overridden `wasm[engine].version()`
 *
 * We have already considered simpler, compact, alternatives to Proxies, but it turns out they're slower on Node v16.15.1.
 * E.g., consider the following:
 *
 * ```ts
 * export const prismaFmt = {
 *   ..._prismaFmt,
 *   version: () => getWasmVersion(BinaryType.prismaFmt),
 * }
 * ```
 *
 * The above code would slow down the 'version with custom binaries (Node-API)' test from 771ms to 5247ms.
 */

export const prismaFmt = new Proxy(_prismaFmt, {
  get(target, prop) {
    return match(prop)
      .with('version', () => () => {
        const overriddenVersion = getWasmVersion(BinaryType.prismaFmt)
        return overriddenVersion
      })
      .otherwise(() => target[prop])
  },
})
