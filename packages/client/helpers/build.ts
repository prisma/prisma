import { Extractor, ExtractorConfig } from '@microsoft/api-extractor'
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
}

// we define the config for edge
const edgeRuntimeBuildConfig: BuildOptions = {
  name: 'edge',
  entryPoints: ['src/runtime/index.ts'],
  outfile: 'runtime/edge',
  bundle: true,
  minify: true,
  legalComments: 'none',
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

// we define the config for generator
const generatorBuildConfig: BuildOptions = {
  name: 'generator',
  entryPoints: ['src/generation/generator.ts'],
  outfile: 'generator-build/index',
  bundle: true,
}

/**
 * Bundle all type definitions by using the API Extractor from RushStack
 * @param filename the source d.ts to bundle
 * @param outfile the output bundled file
 */
function bundleTypeDefinitions(filename: string, outfile: string) {
  // we give the config in its raw form instead of a file
  const extractorConfig = ExtractorConfig.prepare({
    configObject: {
      projectFolder: path.join(__dirname, '..'),
      mainEntryPointFilePath: `${filename}.d.ts`,
      bundledPackages: [
        'decimal.js',
        'sql-template-tag',
        '@prisma/internals',
        '@prisma/engine-core',
        '@prisma/generator-helper',
        '@prisma/debug',
        '@opentelemetry/api',
      ],
      compiler: {
        tsconfigFilePath: 'tsconfig.build.json',
        overrideTsconfig: {
          compilerOptions: {
            paths: {}, // bug with api extract + paths
          },
        },
      },
      dtsRollup: {
        enabled: true,
        untrimmedFilePath: `${outfile}.d.ts`,
      },
      tsdocMetadata: {
        enabled: false,
      },
    },
    packageJsonFullPath: path.join(__dirname, '..', 'package.json'),
    configObjectFullPath: undefined,
  })

  // here we trigger the "command line" interface equivalent
  const extractorResult = Extractor.invoke(extractorConfig, {
    showVerboseMessages: true,
    localBuild: true,
  })

  // we exit the process immediately if there were errors
  if (extractorResult.succeeded === false) {
    console.error(`API Extractor completed with errors`)
    process.exit(1)
  }
}

void build([generatorBuildConfig, nodeRuntimeBuildConfig, browserBuildConfig, edgeRuntimeBuildConfig]).then(() => {
  if (process.env.DEV !== 'true') {
    bundleTypeDefinitions('declaration/runtime/index', 'runtime/index')
    bundleTypeDefinitions('declaration/runtime/index-browser', 'runtime/index-browser')
  }
})
