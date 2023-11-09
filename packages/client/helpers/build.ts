import { ClientEngineType } from '@prisma/internals'
import fs from 'fs'
import path from 'path'

import type { BuildOptions } from '../../../helpers/compile/build'
import { build } from '../../../helpers/compile/build'
import { copyFilePlugin } from '../../../helpers/compile/plugins/copyFilePlugin'
import { fillPlugin } from '../../../helpers/compile/plugins/fill-plugin/fillPlugin'
import { edgePreset } from '../../../helpers/compile/plugins/fill-plugin/presets/edge'
import { noSideEffectsPlugin } from '../../../helpers/compile/plugins/noSideEffectsPlugin'

const wasmEngineDir = path.dirname(require.resolve('@prisma/query-engine-wasm'))
const runtimeDir = path.resolve(__dirname, '..', 'runtime')

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

// does not compile anything, just copies
const wasmEngineConfig: BuildOptions = {
  name: 'wasm',
  emitTypes: false,
  write: false,
  plugins: [
    copyFilePlugin([
      {
        from: path.join(wasmEngineDir, 'query_engine_bg.wasm'),
        to: path.join(runtimeDir, 'query-engine.wasm'),
      },
    ]),
  ],
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

// we define the config for edge
const edgeRuntimeBuildConfig: BuildOptions = {
  name: 'edge',
  target: 'ES2018',
  entryPoints: ['src/runtime/index.ts'],
  outfile: 'runtime/edge',
  bundle: true,
  minify: true,
  sourcemap: 'linked',
  legalComments: 'none',
  emitTypes: false,
  define: {
    // that helps us to tree-shake unused things out
    NODE_CLIENT: 'false',
    // tree shake the Library and Binary engines out
    TARGET_BUILD_TYPE: '"edge"',
    // that fixes an issue with lz-string umd builds
    'define.amd': 'false',
  },
  plugins: [fillPlugin(edgePreset)],
  logLevel: 'error',
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

// all the configs expanded with esm configs
const configs: BuildOptions[] = [
  wasmEngineConfig,
  defaultIndexConfig,
  browserBuildConfig,
  generatorBuildConfig,
  edgeRuntimeBuildConfig,
  nodeRuntimeBuildConfig(ClientEngineType.Binary),
  nodeRuntimeBuildConfig(ClientEngineType.Library),
].flatMap((options) => [options, { ...options, format: 'esm' }])

void build(configs).then(function writeDtsReexport() {
  fs.writeFileSync(path.join(runtimeDir, 'binary.d.ts'), 'export * from "./library"\n')
})
