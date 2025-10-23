import { ClientEngineType } from '@prisma/internals'
import fs from 'fs'
import path from 'path'

import type { BuildOptions } from '../../../helpers/compile/build'
import { build } from '../../../helpers/compile/build'
import { fillPlugin } from '../../../helpers/compile/plugins/fill-plugin/fillPlugin'
import { nodeProtocolPlugin } from '../../../helpers/compile/plugins/nodeProtocolPlugin'
import { noSideEffectsPlugin } from '../../../helpers/compile/plugins/noSideEffectsPlugin'

const fillPluginDir = path.join('..', '..', 'helpers', 'compile', 'plugins', 'fill-plugin')
const functionPolyfillPath = path.join(fillPluginDir, 'fillers', 'function.ts')
const weakrefPolyfillPath = path.join(fillPluginDir, 'fillers', 'weakref.ts')
const runtimeDir = path.resolve(__dirname, '..', 'runtime')

const DRIVER_ADAPTER_SUPPORTED_PROVIDERS = ['postgresql', 'sqlite', 'mysql', 'sqlserver', 'cockroachdb'] as const
type DriverAdapterSupportedProvider = (typeof DRIVER_ADAPTER_SUPPORTED_PROVIDERS)[number]

const MODULE_FORMATS = ['esm', 'cjs'] as const
type ModuleFormat = (typeof MODULE_FORMATS)[number]

const WASM_COMPONENTS = ['engine', 'compiler'] as const
type WasmComponent = (typeof WASM_COMPONENTS)[number]

const ENGINE_TYPES = [ClientEngineType.Binary, ClientEngineType.Library, ClientEngineType.Client]

function getOutExtension(format: ModuleFormat): Record<string, string> {
  return {
    esm: { '.js': '.mjs' },
    cjs: { '.js': '.js' },
  }[format]
}

const shouldMinify = !process.env.DEV && process.env.MINIFY !== 'false'

const NODE_ESM_BANNER = `\
import * as __banner_node_module from "node:module";
import * as __banner_node_path from "node:path";
import * as process from "node:process";
import * as __banner_node_url from "node:url";
const __filename = __banner_node_url.fileURLToPath(import.meta.url);
globalThis['__dirname'] = __banner_node_path.dirname(__filename);
const require = __banner_node_module.createRequire(import.meta.url);`

// we define the config for runtime
function nodeRuntimeBuildConfig(targetBuildType: typeof TARGET_BUILD_TYPE, format: ModuleFormat): BuildOptions {
  return {
    format,
    name: targetBuildType,
    entryPoints: ['src/runtime/index.ts'],
    outfile: `runtime/${targetBuildType}`,
    outExtension: getOutExtension(format),
    bundle: true,
    minify: shouldMinify,
    sourcemap: 'linked',
    emitTypes: ['library', 'client'].includes(targetBuildType),
    external: ['@prisma/client-runtime-utils'],
    define: {
      NODE_CLIENT: 'true',
      TARGET_BUILD_TYPE: JSON.stringify(targetBuildType),
      // that fixes an issue with lz-string umd builds
      'define.amd': 'false',
    },
    plugins: [noSideEffectsPlugin(/^(arg|lz-string)$/), nodeProtocolPlugin],
    banner: format === 'esm' ? { js: NODE_ESM_BANNER } : undefined,
  }
}

function wasmBindgenRuntimeConfig(
  type: WasmComponent,
  provider: DriverAdapterSupportedProvider,
  format: ModuleFormat,
): BuildOptions {
  return {
    format,
    name: `query_${type}_bg.${provider}`,
    entryPoints: [`@prisma/query-${type}-wasm/${provider}/query_${type}_bg.js`],
    outfile: `runtime/query_${type}_bg.${provider}`,
    outExtension: getOutExtension(format),
    minify: shouldMinify,
    plugins: [
      fillPlugin({
        defaultFillers: false,
        fillerOverrides: {
          Function: {
            define: 'fn',
            globals: functionPolyfillPath,
          },
        },
      }),
    ],
  }
}

// we define the config for browser
function browserBuildConfigs(): BuildOptions[] {
  return MODULE_FORMATS.map((format) => ({
    format,
    name: 'browser',
    entryPoints: ['src/runtime/index-browser.ts'],
    outfile: 'runtime/index-browser',
    outExtension: getOutExtension(format),
    target: ['chrome58', 'firefox57', 'safari11', 'edge16'],
    bundle: true,
    minify: shouldMinify,
    sourcemap: 'linked',
    external: ['@prisma/client-runtime-utils'],
  }))
}

/**
 * Overrides meant for edge, wasm and react-native builds
 * If at some point they diverge feel free to split them
 */
const commonRuntimesOverrides = {
  // we remove eval and Function for vercel
  eval: { define: 'undefined' },
  Function: {
    define: 'fn',
    globals: functionPolyfillPath,
  },
  // we shim WeakRef, it does not exist on CF
  WeakRef: {
    globals: weakrefPolyfillPath,
  },
  // these can not be exported anymore
  './warnEnvConflicts': { contents: '' },
}

const runtimesCommonBuildConfig = {
  target: 'ES2022',
  entryPoints: ['src/runtime/index.ts'],
  bundle: true,
  minify: shouldMinify,
  sourcemap: 'linked',
  emitTypes: false,
  define: {
    // that helps us to tree-shake unused things out
    NODE_CLIENT: 'false',
    'globalThis.DEBUG_COLORS': 'false',
    // that fixes an issue with lz-string umd builds
    'define.amd': 'false',
  },
  logLevel: 'error',
  legalComments: 'none',
  external: ['@prisma/client-runtime-utils'],
} satisfies BuildOptions

// React Native is similar to edge in the sense it doesn't have the node API/libraries
// and also not all the browser APIs, therefore it needs to polyfill the same things as edge
const reactNativeBuildConfig: BuildOptions = {
  ...runtimesCommonBuildConfig,
  name: 'react-native',
  outfile: 'runtime/react-native',
  emitTypes: true,
  define: {
    NODE_CLIENT: 'false',
    TARGET_BUILD_TYPE: '"react-native"',
  },
  plugins: [
    fillPlugin({
      fillerOverrides: { ...commonRuntimesOverrides },
    }),
  ],
}

// old-style generator compatiblity shim for studio
const generatorBuildConfig: BuildOptions = {
  name: 'generator',
  entryPoints: ['src/generation/generator.ts'],
  outfile: 'generator-build/index',
  bundle: true,
  emitTypes: false,
}

// default-index.js file in scripts
const defaultIndexConfig: BuildOptions = {
  name: 'default-index',
  entryPoints: ['src/scripts/default-index.ts'],
  outfile: 'scripts/default-index',
  bundle: true,
  emitTypes: false,
}

function writeDtsRexport(fileName: string) {
  fs.writeFileSync(path.join(runtimeDir, fileName), 'export * from "./library"\n')
}

function* allNodeRuntimeBuildConfigs(): Generator<BuildOptions> {
  for (const engineType of ENGINE_TYPES) {
    for (const format of MODULE_FORMATS) {
      yield nodeRuntimeBuildConfig(engineType, format)
    }
  }
}

function* allWasmBindgenRuntimeConfigs(): Generator<BuildOptions> {
  for (const component of WASM_COMPONENTS) {
    for (const provider of DRIVER_ADAPTER_SUPPORTED_PROVIDERS) {
      for (const format of MODULE_FORMATS) {
        yield wasmBindgenRuntimeConfig(component, provider, format)
      }
    }
  }
}

void build([
  generatorBuildConfig,
  ...allNodeRuntimeBuildConfigs(),
  ...browserBuildConfigs(),
  ...allWasmBindgenRuntimeConfigs(),
  defaultIndexConfig,
  reactNativeBuildConfig,
]).then(() => {
  writeDtsRexport('binary.d.ts')
  writeDtsRexport('wasm-compiler-edge.d.ts')
})
