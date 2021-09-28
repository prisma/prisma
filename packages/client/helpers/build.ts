import type { BuildOptions } from '../../../helpers/compile/build'
import { build } from '../../../helpers/compile/build'
import { fillPlugin } from '../../../helpers/compile/plugins/fill-plugin/fillPlugin'
import { Extractor, ExtractorConfig } from '@microsoft/api-extractor'
import path from 'path'

const external = ['_http_common', 'spdx-license-ids', 'spdx-exceptions']

// we define the config for generator
const generatorBuildConfig: BuildOptions = {
  entryPoints: ['src/generation/generator.ts'],
  outfile: 'generator-build/index',
  bundle: true,
  external: external,
}

// we define the config for runtime
const runtimeBuildConfig: BuildOptions = {
  entryPoints: ['src/runtime/index.ts'],
  outfile: 'runtime/index',
  bundle: true,
  external: external,
  define: { 'globalThis.NOT_PROXY': 'true' },
}

// we define the config for browser
const browserBuildConfig: BuildOptions = {
  entryPoints: ['src/runtime/index-browser.ts'],
  outfile: 'runtime/index-browser',
  target: ['chrome58', 'firefox57', 'safari11', 'edge16'],
  bundle: true,
  external: external,
}

// we define the config for proxy
const proxyBuildConfig: BuildOptions = {
  entryPoints: ['src/runtime/index.ts'],
  outfile: 'runtime/proxy',
  bundle: true,
  minify: true,
  legalComments: 'none',
  external: external,
  define: { 'globalThis.NOT_PROXY': 'false' },
  plugins: [
    fillPlugin(
      {
        // TODO no tree shaking on wrapper pkgs
        '@prisma/get-platform': { contents: '' },
        // these can not be exported any longer
        './warnEnvConflicts': { contents: '' },
        './utils/find': { contents: '' },
      },
      // we only trigger it on the first step (esm)
      // because that is where tree-shaking happens
      (options) => options.format === 'esm',
    ),
  ],
  logLevel: 'error',
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
        '@prisma/engine-core',
        '@prisma/generator-helper',
      ],
      compiler: {
        tsconfigFilePath: 'tsconfig.build.json',
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

void build([
  generatorBuildConfig,
  runtimeBuildConfig,
  browserBuildConfig,
  proxyBuildConfig,
]).then(() => {
  if (process.env.DEV !== 'true') {
    bundleTypeDefinitions('declaration/index', 'runtime/index')
    bundleTypeDefinitions('declaration/index', 'runtime/proxy')
    bundleTypeDefinitions('declaration/index-browser', 'runtime/index-browser')
  }
})
