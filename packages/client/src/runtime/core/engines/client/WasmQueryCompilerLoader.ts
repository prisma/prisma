// this import points directly to ./query_compiler_bg.js it is generated with >>>
// wasm-bindgen --browser. --browser is the leanest and most agnostic option
// that is also easy to integrate with our bundling.
// import * as wasmBindgenRuntime from '@prisma/query-compiler-wasm/query_compiler_bg.js'
import { QueryCompilerConstructor } from '@prisma/client-common'
import { PrismaClientInitializationError } from '@prisma/client-runtime-utils'

import { QueryCompilerLoader } from './types/QueryCompiler'

// cache loaded wasm instances by provider
const loadedWasmInstances: Record<string, Promise<QueryCompilerConstructor>> = {}

export const wasmQueryCompilerLoader: QueryCompilerLoader = {
  async loadQueryCompiler(config) {
    const { clientVersion, compilerWasm } = config

    if (compilerWasm === undefined) {
      throw new PrismaClientInitializationError('WASM query compiler was unexpectedly `undefined`', clientVersion)
    }

    let loading: Promise<QueryCompilerConstructor>

    // we only create the instance once for efficiency and also because wasm
    // bindgen keeps an internal cache of its instance already, when the wasm
    // compiler is loaded more than once it crashes with `unwrap_throw failed`.
    if (config.activeProvider === undefined || loadedWasmInstances[config.activeProvider] === undefined) {
      loading = (async () => {
        const runtime = await compilerWasm.getRuntime()
        const wasmModule = await compilerWasm.getQueryCompilerWasmModule()

        if (wasmModule === undefined || wasmModule === null) {
          throw new PrismaClientInitializationError(
            'The loaded wasm module was unexpectedly `undefined` or `null` once loaded',
            clientVersion,
          )
        }

        // from https://developers.cloudflare.com/workers/runtime-apis/webassembly/rust/#javascript-plumbing-wasm-bindgen
        const options = { './query_compiler_bg.js': runtime }
        const instance = new WebAssembly.Instance(wasmModule, options)
        const wbindgen_start = instance.exports.__wbindgen_start as () => void
        runtime.__wbg_set_wasm(instance.exports)
        wbindgen_start()
        return runtime.QueryCompiler
      })()

      // only cache if we have an active provider
      if (config.activeProvider !== undefined) {
        loadedWasmInstances[config.activeProvider] = loading
      }
    } else {
      loading = loadedWasmInstances[config.activeProvider]
    }

    return await loading
  },
}
