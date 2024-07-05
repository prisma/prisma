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
      getRuntime: () => require('./query_engine_bg.js'),
      getQueryEngineWasmModule: async () => {
        const queryEngineWasmFilePath = require('path').join(config.dirname, 'query_engine_bg.wasm')
        const queryEngineWasmFileBytes = require('fs').readFileSync(queryEngineWasmFilePath)
      
        return new WebAssembly.Module(queryEngineWasmFileBytes)
      }
    }`
  }

  // This code block works deals with the following issues:
  // - Vercel / Next.js needs `?module` to be appended to the import path of WebAssembly modules.
  // - Cloudflare Workers and other runtimes do not support the `?module` syntax, and requires a
  //   plain Wasm dynamic import.
  // - `import('#wasm-engine-loader')` enables a conditional import of a file importing the Wasm module
  //   differently depending on the JavaScript runtime environment. However, it's not supported by `vitest`,
  //   so we need to catch the "No such module .prisma/client/#wasm-engine-loader" error.
  //   See: https://github.com/prisma/prisma/pull/24554, https://github.com/vitest-dev/vitest/issues/5486.
  // - The conditional import is only known to be necessary for `vitest`, but Webpack (Next.js' bundler)
  //   will still throw a compile-time error when it statically traverses the `.wasm` import in the `catch` block.
  //   To prevent this, we use a magic comment `/* webpackIgnore: true */` to prevent Webpack from poking around
  //   with dynamic imports that it won't need at runtime anyway.
  //   See: https://github.com/prisma/prisma/issues/24673.
  //   See also https://webpack.js.org/api/module-methods/#webpackignore for documentation on `webpackIgnore`.
  if (copyEngine && wasm === true) {
    return `config.engineWasm = {
  getRuntime: () => require('./query_engine_bg.js'),
  getQueryEngineWasmModule: async () => {
    try {
      // try loading the Wasm module from a conditionally module tag
      const loader = (await import('#wasm-engine-loader')).default
      const engine = (await loader).default
      return engine
    } catch (e) {
      if (e instanceof Error && e.message.includes('No such module')) {
        const engine = (await import(/* webpackIgnore: true */ './query_engine_bg.wasm')).default
        return engine
      }
      throw e
    }
  }
}`
  }

  return `config.engineWasm = undefined`
}
