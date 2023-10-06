/* eslint-disable @typescript-eslint/require-await */
import '@prisma/driver-adapter-utils'

// this import points directly to ./mywasmlib_bg.js it is generated with >>>
// wasm-bindgen --browser. --browser is the leanest and most agnostic option
// that is also easy to integrate with our bundling.
import * as wasmBindgenRuntime from '@prisma/query-engine-wasm/query_engine_bg.js'

import { EngineConfig } from '../common/Engine'
import { LibraryEngine } from '../library/LibraryEngine'

declare const WebAssembly: any // not defined in Node types?

export class WasmEngine extends LibraryEngine {
  constructor(config: EngineConfig) {
    super(config, {
      async loadLibrary() {
        const wasmMod = await config.getQueryEngineWasmModule?.()
        // from https://developers.cloudflare.com/workers/runtime-apis/webassembly/rust/#javascript-plumbing-wasm-bindgen
        const instance = new WebAssembly.Instance(wasmMod, { './query_engine_bg.js': wasmBindgenRuntime })
        wasmBindgenRuntime.__wbg_set_wasm(instance.exports)

        return {
          async debugPanic() {
            throw '{}' // not really used
          },
          async dmmf() {
            return '{}' // not really used
          },
          version() {
            return { commit: 'TODO', version: 'TODO' }
          },
          // after taking a look at the wasm-bindgen output, it seems like we should be able to produce API-compliant engines
          QueryEngine: wasmBindgenRuntime.QueryEngine,
        }
      },
    })
  }
}
