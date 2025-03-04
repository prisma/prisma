import type { TSClientOptions } from '../TSClient/TSClient'

/**
 * Builds the necessary glue code to load the query engine wasm module.
 * @returns
 */
export function buildQueryEngineWasmModule(
  wasm: boolean,
  copyEngine: boolean,
  runtimeNameJs: TSClientOptions['runtimeNameJs'],
) {
  if (copyEngine && runtimeNameJs === 'library' && process.env.PRISMA_CLIENT_FORCE_WASM) {
    return `config.engineWasm = {
      getRuntime: () => require('./query_engine_bg.js'),
      getQueryEngineWasmModule: async () => {
        const queryEngineWasmFilePath = require('path').join(config.dirname, 'query_engine_bg.wasm')
        const queryEngineWasmFileBytes = require('fs').readFileSync(queryEngineWasmFilePath)
      
        return new WebAssembly.Module(queryEngineWasmFileBytes)
      }
    }`
  }

  // For cloudflare (workers) we need to use import in order to load wasm
  // so we use a dynamic import which is compatible with both cjs and esm.
  // Additionally, we need to append `?module` to the import path for vercel,
  // which is incompatible with cloudflare, so we hide it in a template.
  // In `getQueryEngineWasmModule`, we use a `try/catch` block because `vitest`
  // isn't able to handle dynamic imports with `import(#MODULE_NAME)`, which used
  // to lead to a runtime "No such module .prisma/client/#wasm-engine-loader" error.
  // Related issue: https://github.com/vitest-dev/vitest/issues/5486.
  if (copyEngine && wasm === true) {
    return `config.engineWasm = {
  getRuntime: () => require('./query_engine_bg.js'),
  getQueryEngineWasmModule: async () => {
    const loader = (await import('#wasm-engine-loader')).default
    const engine = (await loader).default
    return engine 
  }
}`
  }

  return 'config.engineWasm = undefined'
}
