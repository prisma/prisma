import { capitalize } from '@prisma/client-common'
import { ActiveConnectorType } from '@prisma/generator'
import { match } from 'ts-pattern'

import { ModuleFormat } from '../module-format'
import { RuntimeTarget } from '../runtime-targets'
import { RuntimeName } from '../TSClient/TSClient'

export type BuildWasmModuleOptions = {
  component: 'engine' | 'compiler'
  runtimeName: RuntimeName
  runtimeBase: string
  target: RuntimeTarget
  activeProvider: ActiveConnectorType
  moduleFormat: ModuleFormat
}

/**
 * This function evaluates to:
 * - `import(name)` for all bundler targets, except Webpack, but including Turbopack.
 * - `__non_webpack_require__(name)` for Webpack targets.
 *
 * This is used to dynamically import a module at runtime, while also excluding it from Webpack's bundle.
 * It allows to mitigate the following issues:
 * - https://github.com/webpack/webpack/issues/19607
 * - https://github.com/prisma/prisma/issues/27049
 * - https://github.com/prisma/prisma/issues/27343
 */
export function buildDynamicRequireFn() {
  return `const dynamicRequireFn = async <const T extends string>(name: T) =>
      typeof globalThis.__non_webpack_require__ === 'function'
        ? Promise.resolve(globalThis.__non_webpack_require__(name))
        : await import(/* webpackIgnore: true */ /* @vite-ignore */ name)`
}

export function buildGetWasmModule({
  component,
  runtimeName,
  runtimeBase,
  target,
  activeProvider,
  moduleFormat,
}: BuildWasmModuleOptions) {
  const capitalizedComponent = capitalize(component)

  const wasmPathBase = `${runtimeBase}/query_${component}_bg.${activeProvider}`
  const wasmBindingsPath = `${wasmPathBase}.mjs`
  const wasmModulePath = `${wasmPathBase}.wasm`

  const buildNodeLoader = match(runtimeName)
    .with('library', () => component === 'engine' && !!process.env.PRISMA_CLIENT_FORCE_WASM)
    .with('client', () => component === 'compiler')
    .otherwise(() => false)

  const buildEdgeLoader =
    (runtimeName === 'wasm-engine-edge' && component === 'engine') ||
    (runtimeName === 'wasm-compiler-edge' && component === 'compiler')

  if (buildNodeLoader) {
    return `config.${component}Wasm = {
  getRuntime: async () => await import(${JSON.stringify(wasmBindingsPath)}),

  getQuery${capitalizedComponent}WasmModule: async () => {
    ${buildDynamicRequireFn()}
  
    // Note: we must use dynamic imports here to avoid bundling errors like \`Module parse failed: Unexpected character '' (1:0)\`.
    const { readFile } = await dynamicRequireFn('node:fs/promises')
    ${buildRequire(moduleFormat)}
    const wasmModulePath = _require.resolve(${JSON.stringify(wasmModulePath)})
    const wasmModuleBytes = await readFile(wasmModulePath)

    return new globalThis.WebAssembly.Module(wasmModuleBytes)
  }
}`
  }

  if (buildEdgeLoader) {
    const fullWasmModulePath = target === 'edge-light' ? `${wasmModulePath}?module` : wasmModulePath

    return `config.${component}Wasm = {
  getRuntime: async () => await import(${JSON.stringify(wasmBindingsPath)}),

  getQuery${capitalizedComponent}WasmModule: async () => {
    const { default: module } = await import(${JSON.stringify(fullWasmModulePath)})
    return module
  }
}`
  }

  return `config.${component}Wasm = undefined`
}

function buildRequire(moduleFormat: ModuleFormat): string {
  if (moduleFormat === 'cjs') {
    return 'const _require = require\n'
  }

  return `const { createRequire } = await dynamicRequireFn('node:module')
    const _require = createRequire(import.meta.url)\n`
}
