// this import points directly to ./query_engine_bg.js it is generated with >>>
// wasm-bindgen --browser. --browser is the leanest and most agnostic option
// that is also easy to integrate with our bundling.
import * as wasmBindgenRuntime from '@prisma/query-engine-wasm/query_engine_bg.js'

import { PrismaClientInitializationError } from '../../errors/PrismaClientInitializationError'
import { LibraryLoader } from './types/Library'

declare const WebAssembly: any // TODO not defined in Node types?

export const wasmLibraryLoader: LibraryLoader = {
  async loadLibrary(config) {
    const { generator, clientVersion, adapter } = config
    const wasmMod = await config.getQueryEngineWasmModule?.()

    if (generator?.previewFeatures.includes('driverAdapters') === undefined) {
      throw new PrismaClientInitializationError(
        'The `driverAdapters` preview feature is required with `engineType="wasm"`',
        clientVersion,
      )
    }

    if (adapter === undefined) {
      throw new PrismaClientInitializationError(
        'The `adapter` option for `PrismaClient` is required with `engineType="wasm"`',
        clientVersion,
      )
    }

    if (wasmMod === undefined || wasmMod === null) {
      throw new PrismaClientInitializationError(
        'The loaded wasm module was unexpectedly `undefined` or `null` once loaded',
        clientVersion,
      )
    }

    // from https://developers.cloudflare.com/workers/runtime-apis/webassembly/rust/#javascript-plumbing-wasm-bindgen
    const instance = new WebAssembly.Instance(wasmMod, { './query_engine_bg.js': wasmBindgenRuntime })
    wasmBindgenRuntime.__wbg_set_wasm(instance.exports)

    return {
      debugPanic() {
        return Promise.reject('{}') // not used
      },
      dmmf() {
        return Promise.resolve('{}') // not used
      },
      version() {
        return { commit: 'unknown', version: 'unknown' } // not used
      },
      // after taking a look at the wasm-bindgen output, it seems like we should be able to produce API-compliant engines
      QueryEngine: wasmBindgenRuntime.QueryEngine,
    }
  },
}
