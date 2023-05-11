import fs from 'fs'
import path from 'path'

import type { BuildOptions } from '../../../helpers/compile/build'
import { build } from '../../../helpers/compile/build'
import { fillPlugin } from '../../../helpers/compile/plugins/fill-plugin/fillPlugin'
import { edgePreset } from '../../../helpers/compile/plugins/fill-plugin/presets/edge'
import { esmPreset } from '../../../helpers/compile/plugins/fill-plugin/presets/esm'
import { noSideEffectsPlugin } from '../../../helpers/compile/plugins/noSideEffectsPlugin'

const runtimeDir = path.resolve(__dirname, '..', 'runtime')

// we define the config for runtime
function nodeRuntimeBuildConfig(
  targetEngineType: 'binary' | 'library' | 'data-proxy' | 'all',
  format: 'esm' | 'cjs',
  outFileName: string = targetEngineType,
): BuildOptions {
  const buildConfig: BuildOptions = {
    name: targetEngineType,
    entryPoints: ['src/runtime/index.ts'],
    outfile: `runtime/${outFileName}`,
    bundle: true,
    minify: true,
    sourcemap: 'linked',
    emitTypes: targetEngineType === 'all' && format === 'cjs',
    define: {
      NODE_CLIENT: 'true',
      TARGET_ENGINE_TYPE: JSON.stringify(targetEngineType),
      // that fixes an issue with lz-string umd builds
      'define.amd': 'false',
    },
    plugins: [noSideEffectsPlugin(/^(arg|lz-string)$/)],
  }

  if (format === 'esm') {
    buildConfig.format = 'esm'
    buildConfig.plugins?.push(fillPlugin(esmPreset))
  }

  return buildConfig
}

// we define the config for browser
const browserCjsBuildConfig: BuildOptions = {
  name: 'browser',
  entryPoints: ['src/runtime/index-browser.ts'],
  outfile: 'runtime/index-browser',
  target: ['chrome58', 'firefox57', 'safari11', 'edge16'],
  bundle: true,
}

const browserEsmBuildConfig: BuildOptions = {
  ...browserCjsBuildConfig,
  emitTypes: false,
  format: 'esm',
}

// we define the config for edge
const edgeCjsRuntimeBuildConfig: BuildOptions = {
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
    TARGET_ENGINE_TYPE: '"data-proxy"',
    // that fixes an issue with lz-string umd builds
    'define.amd': 'false',
  },
  plugins: [fillPlugin(edgePreset)],
  logLevel: 'error',
}

// we define the config for edge in esm format
const edgeEsmRuntimeBuildConfig: BuildOptions = {
  ...edgeCjsRuntimeBuildConfig,
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

function writeDtsReExport(fileName: string) {
  fs.writeFileSync(path.join(runtimeDir, fileName), 'export * from "./index"\n')
}

void build([
  generatorBuildConfig,
  // Exists for backward compatibility. Could be removed in next major
  nodeRuntimeBuildConfig('all', 'cjs', 'index'),
  nodeRuntimeBuildConfig('binary', 'cjs'),
  nodeRuntimeBuildConfig('library', 'cjs'),
  nodeRuntimeBuildConfig('data-proxy', 'cjs'),
  nodeRuntimeBuildConfig('all', 'esm', 'index'),
  nodeRuntimeBuildConfig('binary', 'esm'),
  nodeRuntimeBuildConfig('library', 'esm'),
  nodeRuntimeBuildConfig('data-proxy', 'esm'),
  browserCjsBuildConfig,
  browserEsmBuildConfig,
  edgeCjsRuntimeBuildConfig,
  edgeEsmRuntimeBuildConfig,
]).then(() => {
  writeDtsReExport('binary.d.ts')
  writeDtsReExport('library.d.ts')
  writeDtsReExport('data-proxy.d.ts')
})
