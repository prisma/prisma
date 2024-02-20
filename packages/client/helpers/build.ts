import { ClientEngineType } from '@prisma/internals'
import fs from 'fs'
import path from 'path'

import type { BuildOptions } from '../../../helpers/compile/build'
import { build } from '../../../helpers/compile/build'
import { copyFilePlugin } from '../../../helpers/compile/plugins/copyFilePlugin'
import { fillPlugin } from '../../../helpers/compile/plugins/fill-plugin/fillPlugin'
import { noSideEffectsPlugin } from '../../../helpers/compile/plugins/noSideEffectsPlugin'

const wasmEngineDir = path.dirname(require.resolve('@prisma/query-engine-wasm/package.json'))
const wasmSchemaDir = path.dirname(require.resolve('@prisma/prisma-schema-wasm/package.json'))
const fillPluginDir = path.join('..', '..', 'helpers', 'compile', 'plugins', 'fill-plugin')
const functionPolyfillPath = path.join(fillPluginDir, 'fillers', 'function.ts')
const weakrefPolyfillPath = path.join(fillPluginDir, 'fillers', 'weakref.ts')
const runtimeDir = path.resolve(__dirname, '..', 'runtime')
const generatorBuildDir = path.resolve(__dirname, '..', 'generator-build')

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
    emitTypes: targetBuildType === 'library',
    define: {
      NODE_CLIENT: 'true',
      TARGET_BUILD_TYPE: JSON.stringify(targetBuildType),
      // that fixes an issue with lz-string umd builds
      'define.amd': 'false',
    },
    plugins: [noSideEffectsPlugin(/^(arg|lz-string)$/)],
  }
}

function wasmBindgenRuntimeConfig(provider: DriverAdapterSupportedProvider): BuildOptions {
  return {
    name: `query_engine_bg.${provider}`,
    entryPoints: [`@prisma/query-engine-wasm/${provider}/query_engine_bg.js`],
    outfile: `runtime/query_engine_bg.${provider}`,
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

const commonEdgeWasmRuntimeBuildConfig = {
  target: 'ES2018',
  entryPoints: ['src/runtime/index.ts'],
  bundle: true,
  minify: true,
  sourcemap: 'linked',
  emitTypes: false,
  plugins: [
    fillPlugin({
      fillerOverrides: {
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
      },
    }),
  ],
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
  ...commonEdgeWasmRuntimeBuildConfig,
  name: 'edge',
  outfile: 'runtime/edge',
  define: {
    ...commonEdgeWasmRuntimeBuildConfig.define,
    // tree shake the Library and Binary engines out
    TARGET_BUILD_TYPE: '"edge"',
  },
}

// we define the config for wasm
const wasmRuntimeBuildConfig: BuildOptions = {
  ...commonEdgeWasmRuntimeBuildConfig,
  target: 'ES2022',
  name: 'wasm',
  outfile: 'runtime/wasm',
  define: {
    ...commonEdgeWasmRuntimeBuildConfig.define,
    TARGET_BUILD_TYPE: '"wasm"',
  },
  plugins: [
    ...commonEdgeWasmRuntimeBuildConfig.plugins,
    copyFilePlugin(
      DRIVER_ADAPTER_SUPPORTED_PROVIDERS.map((provider) => ({
        from: path.join(wasmEngineDir, provider, 'query_engine_bg.wasm'),
        to: path.join(runtimeDir, `query_engine_bg.${provider}.wasm`),
      })),
    ),
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
  plugins: [
    copyFilePlugin([
      {
        from: path.join(wasmSchemaDir, 'src', 'prisma_schema_build_bg.wasm'),
        to: path.join(generatorBuildDir, 'prisma_schema_build_bg.wasm'),
      },
    ]),
  ],
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
  browserBuildConfig,
  edgeRuntimeBuildConfig,
  edgeEsmRuntimeBuildConfig,
  wasmRuntimeBuildConfig,
  wasmBindgenRuntimeConfig('postgresql'),
  wasmBindgenRuntimeConfig('mysql'),
  wasmBindgenRuntimeConfig('sqlite'),
  defaultIndexConfig,
  accelerateContractBuildConfig,
]).then(() => {
  writeDtsRexport('binary.d.ts')
})
