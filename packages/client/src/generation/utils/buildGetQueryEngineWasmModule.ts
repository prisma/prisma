import { ClientEngineType } from '@prisma/internals'

/**
 * TODO
 * @returns
 */
export function buildGetQueryEngineWasmModule(edge: boolean, engineType: ClientEngineType) {
  if (engineType !== ClientEngineType.Wasm) {
    return `config.getQueryEngineWasmModule = undefined`
  }

  // this could work on cf workers without esm support
  // because dynamic imports work both in CJS and ESM
  // we need to try this out as soon as possible
  if (edge === true) {
    return `config.getQueryEngineWasmModule = () => import('./query-engine.wasm')`
  }

  // by default just make it work on node.js
  return `config.getQueryEngineWasmModule = () => {
  const path = require('path').join(config.dirname, 'query-engine.wasm');
  const bytes = require('fs').readFileSync(path);

  return new WebAssembly.Module(bytes);
}`
}
