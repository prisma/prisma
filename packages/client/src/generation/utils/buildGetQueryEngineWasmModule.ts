import { ClientEngineType } from '@prisma/internals'

/**
 * Builds the necessary glue code to load the query engine wasm module.
 * @returns
 */
export function buildGetQueryEngineWasmModule(edge: boolean, engineType: ClientEngineType) {
  if (engineType !== ClientEngineType.Wasm) {
    return `config.getQueryEngineWasmModule = undefined`
  }

  // for cloudflare (workers) we need to use import in order to load wasm
  // so we use a dynamic import which is compatible with both cjs and esm
  if (edge === true) {
    return `config.getQueryEngineWasmModule = async () => {
  return (await import('./query-engine.wasm')).default
}`
  }

  // by default just make it work on node.js by turning the file into a module
  return `config.getQueryEngineWasmModule = async () => {
  const queryEngineWasmFilePath = require('path').join(config.dirname, 'query-engine.wasm')
  const queryEngineWasmFileBytes = require('fs').readFileSync(queryEngineWasmFilePath)

  return new WebAssembly.Module(queryEngineWasmFileBytes)
}`
}
