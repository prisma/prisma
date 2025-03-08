// this import points directly to ./query_engine_bg.js it is generated with >>>
// wasm-bindgen --browser. --browser is the leanest and most agnostic option
// that is also easy to integrate with our bundling.
// import * as wasmBindgenRuntime from '@prisma/query-engine-wasm/query_engine_bg.js'
import { getRuntime } from '../../../utils/getRuntime'
import { PrismaClientInitializationError } from '../../errors/PrismaClientInitializationError'
import type { LibraryLoader, QueryEngineConstructor } from './types/Library'

declare const WebAssembly: any // TODO not defined in Node types?

let loadedWasmInstance: Promise<QueryEngineConstructor>
export const wasmLibraryLoader: LibraryLoader = {
  async loadLibrary(config) {
    const { clientVersion, adapter, engineWasm } = config

    if (adapter === undefined) {
      throw new PrismaClientInitializationError(
        `The \`adapter\` option for \`PrismaClient\` is required in this context (${getRuntime().prettyName})`,
        clientVersion,
      )
    }

    if (engineWasm === undefined) {
      throw new PrismaClientInitializationError('WASM engine was unexpectedly `undefined`', clientVersion)
    }

    // we only create the instance once for efficiency and also because wasm
    // bindgen keeps an internal cache of its instance already, when the wasm
    // engine is loaded more than once it crashes with `unwrap_throw failed`.
    if (loadedWasmInstance === undefined) {
      loadedWasmInstance = (async () => {
        const runtime = engineWasm.getRuntime()
        const wasmModule = await engineWasm.getQueryEngineWasmModule()

        if (wasmModule === undefined || wasmModule === null) {
          throw new PrismaClientInitializationError(
            'The loaded wasm module was unexpectedly `undefined` or `null` once loaded',
            clientVersion,
          )
        }

        // from https://developers.cloudflare.com/workers/runtime-apis/webassembly/rust/#javascript-plumbing-wasm-bindgen
        const options = { './query_engine_bg.js': runtime }
        const instance = new WebAssembly.Instance(wasmModule, options)
        const wbindgen_start = instance.exports.__wbindgen_start as () => void
        runtime.__wbg_set_wasm(instance.exports)
        wbindgen_start()
        return runtime.QueryEngine
      })()
    }

    const QueryEngine = await loadedWasmInstance

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
      QueryEngine,
    }
  },
}
