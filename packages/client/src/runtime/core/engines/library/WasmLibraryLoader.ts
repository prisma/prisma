// this import points directly to ./mywasmlib_bg.js it is generated with >>>
// wasm-bindgen --browser. --browser is the leanest and most agnostic option
// that is also easy to integrate with our bundling.
import * as wasmBindgenRuntime from '@prisma/query-engine-wasm/query_engine_bg.js'

import { LibraryLoader } from './types/Library'

declare const WebAssembly: any // TODO not defined in Node types?

export const wasmLibraryLoader: LibraryLoader = {
  async loadLibrary(config) {
    const wasmMod = await config.getQueryEngineWasmModule?.()

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
