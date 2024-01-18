import { TSClientOptions } from '../TSClient/TSClient'

/**
 * Builds the necessary glue code to load the query engine wasm module.
 * @returns
 */
export function buildGetQueryEngineWasmModule(wasm: boolean, runtimeName: TSClientOptions['runtimeName']) {
  if (runtimeName === 'library' && process.env.PRISMA_CLIENT_FORCE_WASM) {
    return `config.getQueryEngineWasmModule = async () => {
      const queryEngineWasmFilePath = require('path').join(config.dirname, 'query-engine.wasm')
      const queryEngineWasmFileBytes = require('fs').readFileSync(queryEngineWasmFilePath)
    
      return new WebAssembly.Module(queryEngineWasmFileBytes)
    }`
  }

  // for cloudflare (workers) we need to use import in order to load wasm
  // so we use a dynamic import which is compatible with both cjs and esm
  // additionally we need to append ?module to the import path for vercel
  // this is incompatible with cloudflare, so we hide it in a template
  if (wasm === true) {
    return `config.getQueryEngineWasmModule = async () => {
      if (detectRuntime() === 'edge-light') {
        return (await import(\`./query-engine.wasm\${'?module'}\`)).default
      } else {
        return (await import(\`./query-engine.wasm\`)).default
      }
}`
  }

  return `config.getQueryEngineWasmModule = undefined`
}
