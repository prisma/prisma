import { capitalize } from '@prisma/client-common'
import { ActiveConnectorType } from '@prisma/generator'
import { match } from 'ts-pattern'

import { RuntimeTarget } from '../runtime-targets'
import { RuntimeName } from '../TSClient/TSClient'

export type BuildWasmModuleOptions = {
  component: 'engine' | 'compiler'
  runtimeName: RuntimeName
  runtimeBase: string
  target: RuntimeTarget
  activeProvider: ActiveConnectorType
}

export function buildGetWasmModule({
  component,
  runtimeName,
  runtimeBase,
  target,
  activeProvider,
}: BuildWasmModuleOptions) {
  const capitalizedComponent = capitalize(component)

  const wasmPathBase = `${runtimeBase}/query_compiler_bg.${activeProvider}`
  const wasmBindingsPath = `${wasmPathBase}.mjs`
  const wasmModulePath = `${wasmPathBase}.wasm`

  const buildNodeLoader = match(runtimeName)
    .with('library', () => component === 'engine' && !!process.env.PRISMA_CLIENT_FORCE_WASM)
    .with('client', () => component === 'compiler')
    .otherwise(() => false)

  // We're missing an edge bundle for client engine right now
  const buildEdgeLoader = runtimeName === 'wasm' && component === 'engine'

  if (buildNodeLoader) {
    return `config.${component}Wasm = {
  getRuntime: async () => await import(${JSON.stringify(wasmBindingsPath)}),

  getQuery${capitalizedComponent}WasmModule: async () => {
    const { createRequire } = await import('node:module')
    const { readFile } = await import('node:fs/promises')

    const require = createRequire(import.meta.url)
    const wasmModulePath = require.resolve(${JSON.stringify(wasmModulePath)})
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
