import type { TSClientOptions } from '../TSClient/TSClient'

/**
 * Builds the necessary glue code to load the query compiler wasm module.
 * @returns
 */
export function buildQueryCompilerWasmModule(
  wasm: boolean,
  copyCompiler: boolean,
  runtimeNameJs: TSClientOptions['runtimeNameJs'],
) {
  if (copyCompiler && runtimeNameJs === 'client') {
    return `config.compilerWasm = {
      getRuntime: () => require('./query_compiler_bg.js'),
      getQueryCompilerWasmModule: async () => {
        const queryCompilerWasmFilePath = require('path').join(config.dirname, 'query_compiler_bg.wasm')
        const queryCompilerWasmFileBytes = require('fs').readFileSync(queryCompilerWasmFilePath)
      
        return new WebAssembly.Module(queryCompilerWasmFileBytes)
      }
    }`
  }

  // For cloudflare (workers) we need to use import in order to load wasm
  // so we use a dynamic import which is compatible with both cjs and esm.
  // Additionally, we need to append `?module` to the import path for vercel,
  // which is incompatible with cloudflare, so we hide it in a template.
  // In `getQueryCompilerWasmModule`, we use a `try/catch` block because `vitest`
  // isn't able to handle dynamic imports with `import(#MODULE_NAME)`, which used
  // to lead to a runtime "No such module .prisma/client/#wasm-compiler-loader" error.
  // Related issue: https://github.com/vitest-dev/vitest/issues/5486.
  if (copyCompiler && runtimeNameJs === 'client' && wasm === true) {
    return `config.compilerWasm = {
  getRuntime: () => require('./query_compiler_bg.js'),
  getQueryCompilerWasmModule: async () => {
    const loader = (await import('#wasm-compiler-loader')).default
    const compiler = (await loader).default
    return compiler 
  }
}`
  }

  return 'config.compilerWasm = undefined'
}
