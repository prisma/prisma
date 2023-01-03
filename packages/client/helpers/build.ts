import path from 'path'

import type { BuildOptions } from '../../../helpers/compile/build'
import { build } from '../../../helpers/compile/build'
import { fillPlugin } from '../../../helpers/compile/plugins/fill-plugin/fillPlugin'

const fillPluginPath = path.join('..', '..', 'helpers', 'compile', 'plugins', 'fill-plugin')
const functionPolyfillPath = path.join(fillPluginPath, 'fillers', 'function.ts')

// we define the config for runtime
const nodeRuntimeBuildConfig: BuildOptions = {
  name: 'runtime',
  entryPoints: ['src/runtime/index.ts'],
  outfile: 'runtime/index',
  bundle: true,
  metafile: true,
  define: {
    NODE_CLIENT: 'true',
    // that fixes an issue with lz-string umd builds
    'define.amd': 'false',
  },
}

// we define the config for browser
const browserBuildConfig: BuildOptions = {
  name: 'browser',
  entryPoints: ['src/runtime/index-browser.ts'],
  outfile: 'runtime/index-browser',
  target: ['chrome58', 'firefox57', 'safari11', 'edge16'],
  bundle: true,
  metafile: true,
}

// we define the config for edge
const edgeRuntimeBuildConfig: BuildOptions = {
  name: 'edge',
  entryPoints: ['src/runtime/index.ts'],
  outfile: 'runtime/edge',
  bundle: true,
  metafile: true,
  minify: true,
  legalComments: 'none',
  emitTypes: false,
  define: {
    // that helps us to tree-shake unused things out
    NODE_CLIENT: 'false',
    // that fixes an issue with lz-string umd builds
    'define.amd': 'false',
  },
  plugins: [
    fillPlugin({
      // we remove eval and Function for vercel
      eval: { define: 'undefined' },
      Function: {
        define: 'fn',
        inject: functionPolyfillPath,
      },

      // TODO no tree shaking on wrapper pkgs
      '@prisma/get-platform': { contents: '' },
      // removes un-needed code out of `chalk`
      'supports-color': { contents: '' },
      // these can not be exported any longer
      './warnEnvConflicts': { contents: '' },
      './utils/find': { contents: '' },
    }),
  ],
  logLevel: 'error',
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
  metafile: true,
  emitTypes: false,
}

void build([
  generatorBuildConfig,
  nodeRuntimeBuildConfig,
  browserBuildConfig,
  edgeRuntimeBuildConfig,
  edgeEsmRuntimeBuildConfig,
])
