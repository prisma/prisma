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

        let instance: WebAssembly.Instance

        try {
          instance = new WebAssembly.Instance(wasmModule, options)
        } catch (e: unknown) {
          const message = (e as any)?.message ?? ''

          const isCompileError =
            typeof WebAssembly !== 'undefined' &&
            typeof WebAssembly.CompileError !== 'undefined' &&
            e instanceof WebAssembly.CompileError

          const embedderBlocked =
            isCompileError && message.includes('Wasm code generation disallowed by embedder')

          if (embedderBlocked) {
            throw new PrismaClientInitializationError(
              [
                'Prisma Client could not initialize the WASM-based query compiler in this environment.',
                'This typically happens when a Node.js Prisma Client is generated or bundled for an edge runtime',
                'that blocks dynamic WebAssembly compilation (for example, Cloudflare Workers).',
                'Generate an edge-compatible Prisma Client and verify your bundler configuration',
                'according to the Prisma edge deployment documentation.',
              ].join(' '),
              clientVersion,
            )
          }

          // Re-throw anything else to avoid hiding other issues
          throw e
        }

        const options = { [compilerWasm.importName]: runtime }
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
