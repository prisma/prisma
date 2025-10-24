import { TSClientOptions } from '../TSClient/TSClient'

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
      getRuntime: async () => require('./query_engine_bg.js'),
      getQueryEngineWasmModule: async () => {
        const queryEngineWasmFilePath = require('path').join(config.dirname, 'query_engine_bg.wasm')
        const queryEngineWasmFileBytes = require('fs').readFileSync(queryEngineWasmFilePath)

        return new WebAssembly.Module(queryEngineWasmFileBytes)
      }
    }`
  }

  return `config.engineWasm = undefined`
}
