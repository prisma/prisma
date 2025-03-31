import fs from 'node:fs/promises'
import path from 'node:path'

import type { ErrorCapturingSqlDriverAdapterFactory } from '@prisma/driver-adapter-utils'
import type { SchemaEngine } from '@prisma/schema-engine-wasm'

async function getSchemaEngineWasModule() {
  const runtimeBase = path.join(__dirname, '..', 'build')
  const schemaEngineWasmFilePath = path.join(runtimeBase, `schema_engine_bg.wasm`)
  const schemaEngineWasmFileBytes = await fs.readFile(schemaEngineWasmFilePath)

  return new WebAssembly.Module(schemaEngineWasmFileBytes)
}

let loadedWasmInstance: Promise<SchemaEngine>
export const wasmSchemaEngineLoader = {
  async loadSchemaEngine(adapter: ErrorCapturingSqlDriverAdapterFactory) {
    // we only create the instance once for efficiency and also because wasm
    // bindgen keeps an internal cache of its instance already, when the wasm
    // compiler is loaded more than once it crashes with `unwrap_throw failed`.
    if (loadedWasmInstance === undefined) {
      loadedWasmInstance = (async () => {
        // this import points directly to ./schema_engine_bg.js it is generated with >>>
        // wasm-bindgen --target bundler, whose target is the leanest and most agnostic option
        // that is also easy to integrate with our bundling.
        const runtime = await import('@prisma/schema-engine-wasm/schema_engine_bg')
        const wasmModule = await getSchemaEngineWasModule()

        console.log('[runtime]', runtime)
        console.log('[runtime]', runtime.default)

        // from https://developers.cloudflare.com/workers/runtime-apis/webassembly/rust/#javascript-plumbing-wasm-bindgen
        const instance = new WebAssembly.Instance(wasmModule, {
          // @ts-ignore
          './schema_engine_bg.js': runtime,
        })
        const wbindgen_start = instance.exports.__wbindgen_start as () => void
        runtime.__wbg_set_wasm(instance.exports)
        wbindgen_start()

        const engine = await runtime.SchemaEngine.new(adapter)
        return engine
      })()
    }

    return await loadedWasmInstance
  },
}
