import { ClientEngineType } from '@prisma/internals'

/**
 * TODO
 * @returns
 */
export function buildGetQueryEngineWasmModule(edge: boolean, engineType: ClientEngineType) {
  if (engineType !== ClientEngineType.Wasm) {
    return `config.getQueryEngineWasmModule = undefined`
  }

  // this could work on cf workers without esm support because dynamic imports
  // work both in CJS and ESM we need to try this out as soon as possible
  if (edge === true) {
    return `config.getQueryEngineWasmModule = async () => {
  return (await import('./query-engine.wasm')).default
}`
  }

  // by default just make it work on node.js by turning the file into a module
  return `config.getQueryEngineWasmModule = () => {
  const queryEngineWasmFilePath = require('path').join(config.dirname, 'query-engine.wasm')
  const queryEngineWasmFileBytes = require('fs').readFileSync(queryEngineWasmFilePath)

  return new WebAssembly.Module(queryEngineWasmFileBytes)
}`
}
