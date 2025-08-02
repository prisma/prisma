import { ClientEngineType } from '@prisma/internals'
import fs from 'fs'
import path from 'path'

import type { BuildOptions } from '../../../helpers/compile/build'
import { build } from '../../../helpers/compile/build'
import { copyFilePlugin } from '../../../helpers/compile/plugins/copyFilePlugin'
import { fillPlugin, smallBuffer, smallDecimal } from '../../../helpers/compile/plugins/fill-plugin/fillPlugin'
import { nodeProtocolPlugin } from '../../../helpers/compile/plugins/nodeProtocolPlugin'
import { noSideEffectsPlugin } from '../../../helpers/compile/plugins/noSideEffectsPlugin'

const wasmQueryEngineDir = path.dirname(require.resolve('@prisma/query-engine-wasm/package.json'))
const wasmQueryCompilerDir = path.dirname(require.resolve('@prisma/query-compiler-wasm/package.json'))
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
const __dirname = __banner_node_path.dirname(__filename);
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
const browserBuildConfig: BuildOptions = {
  name: 'browser',
  entryPoints: ['src/runtime/index-browser.ts'],
  outfile: 'runtime/index-browser',
  target: ['chrome58', 'firefox57', 'safari11', 'edge16'],
  bundle: true,
  minify: shouldMinify,
  sourcemap: 'linked',
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
} satisfies BuildOptions

// we define the config for edge
const edgeRuntimeBuildConfig: BuildOptions = {
  ...runtimesCommonBuildConfig,
  name: 'edge',
  outfile: 'runtime/edge',
  emitTypes: true,
  define: {
    ...runtimesCommonBuildConfig.define,
    // tree shake the Library and Binary engines out
    TARGET_BUILD_TYPE: '"edge"',
  },
  plugins: [
    fillPlugin({
      fillerOverrides: commonRuntimesOverrides,
    }),
  ],
}

function wasmFileToBase64(wasmBuffer: Buffer, format: ModuleFormat = 'esm'): string {
  const base64 = wasmBuffer.toString('base64')
  const moduleExports = format === 'esm' ? 'export { wasm }' : 'module.exports = { wasm }'
  const encodedWasmContent = `const wasm = "data:application/wasm;base64,${base64}";\n${moduleExports}\n`
  return encodedWasmContent
}

// we define the config for wasm
function wasmEdgeRuntimeBuildConfig(type: WasmComponent, format: ModuleFormat, name: string): BuildOptions {
  return {
    ...runtimesCommonBuildConfig,
    format,
    target: 'ES2022',
    name,
    outfile: `runtime/${name}`,
    outExtension: getOutExtension(format),
    define: {
      ...runtimesCommonBuildConfig.define,
      TARGET_BUILD_TYPE: `"${name}"`,
    },
    plugins: [
      fillPlugin({
        // not yet enabled in edge build while driverAdapters is not GA
        fillerOverrides: { ...commonRuntimesOverrides, ...smallBuffer, ...smallDecimal },
      }),
      copyFilePlugin(
        DRIVER_ADAPTER_SUPPORTED_PROVIDERS.map((provider) => ({
          from: path.join(
            type === 'compiler' ? wasmQueryCompilerDir : wasmQueryEngineDir,
            provider,
            `query_${type}_bg.wasm`,
          ),
          to: path.join(runtimeDir, `query_${type}_bg.${provider}.wasm`),
        })),
      ),
      {
        name: 'wasm-base64-encoder',
        setup(build) {
          build.onEnd(() => {
            for (const provider of DRIVER_ADAPTER_SUPPORTED_PROVIDERS) {
              const wasmFilePath = path.join(runtimeDir, `query_${type}_bg.${provider}.wasm`)

              const extToModuleFormatMap = {
                esm: 'mjs',
                cjs: 'cjs',
              } satisfies Record<ModuleFormat, string>

              for (const [moduleFormat, extension] of Object.entries(extToModuleFormatMap)) {
                const base64FilePath = path.join(runtimeDir, `query_${type}_bg.${provider}.wasm-base64.${extension}`)

                try {
                  const wasmBuffer = fs.readFileSync(wasmFilePath)
                  const base64Content = wasmFileToBase64(wasmBuffer, moduleFormat as ModuleFormat)
                  fs.writeFileSync(base64FilePath, base64Content)
                } catch (error) {
                  throw new Error(`Failed to create base64 encoded WASM file for ${provider}:`, error as Error)
                }
              }
            }
          })
        },
      },
    ],
  }
}

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

// we define the config for edge in esm format
const edgeEsmRuntimeBuildConfig: BuildOptions = {
  ...edgeRuntimeBuildConfig,
  name: 'edge-esm',
  outfile: 'runtime/edge-esm',
  format: 'esm',
  emitTypes: false,
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

const accelerateContractBuildConfig: BuildOptions = {
  name: 'accelerate-contract',
  entryPoints: ['src/runtime/core/engines/accelerate/AccelerateEngine.ts'],
  outfile: '../accelerate-contract/dist/index',
  format: 'cjs',
  bundle: true,
  emitTypes: true,
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

function* allWasmEdgeRuntimeConfigs(): Generator<BuildOptions> {
  for (const component of WASM_COMPONENTS) {
    for (const format of MODULE_FORMATS) {
      yield wasmEdgeRuntimeBuildConfig(component, format, `wasm-${component}-edge`)
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
  browserBuildConfig,
  edgeRuntimeBuildConfig,
  edgeEsmRuntimeBuildConfig,
  ...allWasmEdgeRuntimeConfigs(),
  ...allWasmBindgenRuntimeConfigs(),
  defaultIndexConfig,
  reactNativeBuildConfig,
  accelerateContractBuildConfig,
]).then(() => {
  writeDtsRexport('binary.d.ts')
  writeDtsRexport('wasm-engine-edge.d.ts')
  writeDtsRexport('wasm-compiler-edge.d.ts')
})
