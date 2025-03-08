import { ClientEngineType } from '@prisma/internals'
import fs from 'node:fs'
import path from 'node:path'

import type { BuildOptions } from '../../../helpers/compile/build'
import { build } from '../../../helpers/compile/build'
import { copyFilePlugin } from '../../../helpers/compile/plugins/copyFilePlugin'
import { fillPlugin, smallBuffer, smallDecimal } from '../../../helpers/compile/plugins/fill-plugin/fillPlugin'
import { noSideEffectsPlugin } from '../../../helpers/compile/plugins/noSideEffectsPlugin'

const wasmQueryEngineDir = path.dirname(require.resolve('@prisma/query-engine-wasm/package.json'))
const wasmQueryCompilerDir = path.dirname(require.resolve('@prisma/query-compiler-wasm/package.json'))
const fillPluginDir = path.join('..', '..', 'helpers', 'compile', 'plugins', 'fill-plugin')
const functionPolyfillPath = path.join(fillPluginDir, 'fillers', 'function.ts')
const weakrefPolyfillPath = path.join(fillPluginDir, 'fillers', 'weakref.ts')
const runtimeDir = path.resolve(__dirname, '..', 'runtime')

const DRIVER_ADAPTER_SUPPORTED_PROVIDERS = ['postgresql', 'sqlite', 'mysql'] as const

type DriverAdapterSupportedProvider = (typeof DRIVER_ADAPTER_SUPPORTED_PROVIDERS)[number]

// we define the config for runtime
function nodeRuntimeBuildConfig(targetBuildType: typeof TARGET_BUILD_TYPE): BuildOptions {
  return {
    name: targetBuildType,
    entryPoints: ['src/runtime/index.ts'],
    outfile: `runtime/${targetBuildType}`,
    bundle: true,
    minify: true,
    sourcemap: 'linked',
    emitTypes: ['library', 'client'].includes(targetBuildType),
    define: {
      NODE_CLIENT: 'true',
      TARGET_BUILD_TYPE: JSON.stringify(targetBuildType),
      // that fixes an issue with lz-string umd builds
      'define.amd': 'false',
    },
    plugins: [noSideEffectsPlugin(/^(arg|lz-string)$/)],
  }
}

function wasmBindgenRuntimeConfig(type: 'engine' | 'compiler', provider: DriverAdapterSupportedProvider): BuildOptions {
  return {
    name: `query_${type}_bg.${provider}`,
    entryPoints: [`@prisma/query-${type}-wasm/${provider}/query_${type}_bg.js`],
    outfile: `runtime/query_${type}_bg.${provider}`,
    minify: true,
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
  minify: true,
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
  target: 'ES2021',
  entryPoints: ['src/runtime/index.ts'],
  bundle: true,
  minify: true,
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

// we define the config for wasm
function wasmRuntimeBuildConfig(type: 'engine' | 'compiler'): BuildOptions {
  return {
    ...runtimesCommonBuildConfig,
    target: 'ES2022',
    name: 'wasm',
    outfile: 'runtime/wasm',
    define: {
      ...runtimesCommonBuildConfig.define,
      TARGET_BUILD_TYPE: '"wasm"',
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
    ],
  }
}

// React Native is similar to edge in the sense it doesn't have the node API/libraries
// and also not all the browser APIs, therefore it needs to polyfill the same things as edge
const reactNativeBuildConfig: BuildOptions = {
  ...runtimesCommonBuildConfig,
  name: 'react-native',
  target: 'ES2022',
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

// we define the config for edge in esm format (used by deno)
const edgeEsmRuntimeBuildConfig: BuildOptions = {
  ...edgeRuntimeBuildConfig,
  name: 'edge-esm',
  outfile: 'runtime/edge-esm',
  format: 'esm',
}

// we define the config for generator
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

void build([
  generatorBuildConfig,
  nodeRuntimeBuildConfig(ClientEngineType.Binary),
  nodeRuntimeBuildConfig(ClientEngineType.Library),
  nodeRuntimeBuildConfig(ClientEngineType.Client),
  browserBuildConfig,
  edgeRuntimeBuildConfig,
  edgeEsmRuntimeBuildConfig,
  wasmRuntimeBuildConfig('engine'),
  wasmRuntimeBuildConfig('compiler'),
  wasmBindgenRuntimeConfig('engine', 'postgresql'),
  wasmBindgenRuntimeConfig('engine', 'mysql'),
  wasmBindgenRuntimeConfig('engine', 'sqlite'),
  wasmBindgenRuntimeConfig('compiler', 'postgresql'),
  wasmBindgenRuntimeConfig('compiler', 'mysql'),
  wasmBindgenRuntimeConfig('compiler', 'sqlite'),
  defaultIndexConfig,
  reactNativeBuildConfig,
  accelerateContractBuildConfig,
]).then(() => {
  writeDtsRexport('binary.d.ts')
})
