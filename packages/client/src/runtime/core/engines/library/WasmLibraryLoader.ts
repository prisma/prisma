// this import points directly to ./query_engine_bg.js it is generated with >>>
// wasm-bindgen --browser. --browser is the leanest and most agnostic option
// that is also easy to integrate with our bundling.
import * as wasmBindgenRuntime from '@prisma/query-engine-wasm/query_engine_bg.js'

import { PrismaClientInitializationError } from '../../errors/PrismaClientInitializationError'
import { LibraryLoader } from './types/Library'

declare const WebAssembly: any // TODO not defined in Node types?

let loadedWasmInstance: any
export const wasmLibraryLoader: LibraryLoader = {
  async loadLibrary(config) {
    const { generator, clientVersion, adapter } = config

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

    // we only create the instance once for efficiency and also because wasm
    // bindgen keeps an internal cache of its instance already, when the wasm
    // engine is loaded more than once it crashes with `unwrap_throw failed`.
    if (loadedWasmInstance === undefined) {
      const wasmMod = await config.getQueryEngineWasmModule?.()

      if (wasmMod === undefined || wasmMod === null) {
        throw new PrismaClientInitializationError(
          'The loaded wasm module was unexpectedly `undefined` or `null` once loaded',
          clientVersion,
        )
      }

      // from https://developers.cloudflare.com/workers/runtime-apis/webassembly/rust/#javascript-plumbing-wasm-bindgen
      loadedWasmInstance = new WebAssembly.Instance(wasmMod, { './query_engine_bg.js': wasmBindgenRuntime }).exports
      wasmBindgenRuntime.__wbg_set_wasm(loadedWasmInstance)
    }

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
      QueryEngine: wasmBindgenRuntime.QueryEngine,
    }
  },
}
