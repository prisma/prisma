// this import points directly to ./query_engine_bg.js it is generated with >>>
// wasm-bindgen --browser. --browser is the leanest and most agnostic option
// that is also easy to integrate with our bundling.
import * as wasmBindgenRuntime from '@prisma/query-engine-wasm/query_engine_bg.js'
import { detectRuntime } from 'detect-runtime'

import { PrismaClientInitializationError } from '../../errors/PrismaClientInitializationError'
import { LibraryLoader } from './types/Library'

declare const WebAssembly: any // TODO not defined in Node types?

let loadedWasmInstance: any
export const wasmLibraryLoader: LibraryLoader = {
  async loadLibrary(config) {
    const { clientVersion, adapter } = config

    if (adapter === undefined) {
      throw new PrismaClientInitializationError(
        `The \`adapter\` option for \`PrismaClient\` is required in this context (${detectRuntime()})`,
        clientVersion,
      )
    }

    // we only create the instance once for efficiency and also because wasm
    // bindgen keeps an internal cache of its instance already, when the wasm
    // engine is loaded more than once it crashes with `unwrap_throw failed`.
    if (loadedWasmInstance === undefined) {
      loadedWasmInstance = (async () => {
        const wasmModule = await config.getQueryEngineWasmModule?.()

        if (wasmModule === undefined || wasmModule === null) {
          throw new PrismaClientInitializationError(
            'The loaded wasm module was unexpectedly `undefined` or `null` once loaded',
            clientVersion,
          )
        }

        // from https://developers.cloudflare.com/workers/runtime-apis/webassembly/rust/#javascript-plumbing-wasm-bindgen
        const options = { './query_engine_bg.js': wasmBindgenRuntime }
        const instance = new WebAssembly.Instance(wasmModule, options)
        wasmBindgenRuntime.__wbg_set_wasm(instance.exports)
      })()
    }

    await loadedWasmInstance

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
