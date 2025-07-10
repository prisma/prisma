import fs from 'node:fs'
import path from 'node:path'

import { capitalize } from '@prisma/client-common'
import { ActiveConnectorType } from '@prisma/generator'
import { match } from 'ts-pattern'

import type { FileMap } from '../generateClient'
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
function buildDynamicRequireFn() {
  return `const dynamicRequireFn = async <const T extends string>(name: T) =>
      typeof globalThis.__non_webpack_require__ === 'function'
        ? Promise.resolve(globalThis.__non_webpack_require__(name))
        : await import(/* webpackIgnore: true */ /* @vite-ignore */ name)`
}

function usesEdgeWasmRuntime(component: 'engine' | 'compiler', runtimeName: RuntimeName) {
  return (
    (runtimeName === 'wasm-engine-edge' && component === 'engine') ||
    (runtimeName === 'wasm-compiler-edge' && component === 'compiler')
  )
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

  const buildEdgeLoader = usesEdgeWasmRuntime(component, runtimeName)

  let wasmBindingsPath: string
  let wasmModulePath: string

  // When using import statements to load the WASM modules, we put the related
  // files in the generated client directory since some bundlers act weird when
  // importing them from the `@prisma/client` package. We can then rely on the
  // bundler to copy the WebAssembly module to the output directory and modify
  // the paths as needed.
  //
  // Conversely, when using `fs.readFile` in Node.js-like environments,
  // potential usage of bundlers (or even transpiling TS with tsc into a
  // different directory!) would break loading the WASM modules if we copied
  // them to the generated client directory because they would not be where we
  // expect them to be anymore. Therefore, we don't copy anything when
  // generating code for `library` or `client` runtimes, and we always load from
  // `@prisma/client/runtime` when doing it manually with `fs.readFile`. The
  // issues that can arise when importing WASM from node_modules with bundlers
  // don't apply in this case because we are not *importing* them, we're just
  // reading a file on disk.
  if (buildEdgeLoader) {
    const wasmPathBase = `./query_${component}_bg`
    wasmBindingsPath = `${wasmPathBase}.js`
    wasmModulePath = `${wasmPathBase}.wasm`
  } else {
    const wasmPathBase = `${runtimeBase}/query_${component}_bg.${activeProvider}`
    wasmBindingsPath = `${wasmPathBase}.mjs`
    wasmModulePath = `${wasmPathBase}.wasm`
  }

  const buildNodeLoader = match(runtimeName)
    .with('library', () => component === 'engine' && !!process.env.PRISMA_CLIENT_FORCE_WASM)
    .with('client', () => component === 'compiler')
    .otherwise(() => false)

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

export type BuildWasmFileMapOptions = {
  runtimeName: RuntimeName
  activeProvider: ActiveConnectorType
}

export function buildWasmFileMap({ runtimeName, activeProvider }: BuildWasmFileMapOptions): FileMap {
  const fileMap: FileMap = {}

  for (const component of ['engine', 'compiler'] as const) {
    if (!usesEdgeWasmRuntime(component, runtimeName)) {
      continue
    }

    const fileNameBase = `query_${component}_bg.${activeProvider}`
    const files = {
      [`query_${component}_bg.wasm`]: `${fileNameBase}.wasm`,
      [`query_${component}_bg.js`]: `${fileNameBase}.mjs`,
    }

    for (const [targetFile, sourceFile] of Object.entries(files)) {
      const bundledLocation = path.join(__dirname, sourceFile)
      const sourceLocation = path.join(__dirname, '..', '..', '..', 'client', 'runtime', sourceFile)

      if (fs.existsSync(bundledLocation)) {
        // The artifact exists in __dirname, this means we are in the bundled Prisma CLI
        fileMap[targetFile] = fs.readFileSync(bundledLocation)
      } else if (fs.existsSync(sourceLocation)) {
        // The artifact exists in the source location, this means we are in the development environment or tests
        fileMap[targetFile] = fs.readFileSync(sourceLocation)
      } else {
        throw new Error(`Could not find ${sourceFile} in ${bundledLocation} or ${sourceLocation}`)
      }
    }
  }

  return fileMap
}
