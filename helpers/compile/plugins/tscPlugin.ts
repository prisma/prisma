import { Extractor, ExtractorConfig } from '@microsoft/api-extractor'
import type * as esbuild from 'esbuild'
import fs from 'fs-extra'
import path from 'path'

import { run } from '../run'

/**
 * Bundle all type definitions by using the API Extractor from RushStack
 * @param filename the source d.ts to bundle
 * @param outfile the output bundled file
 */
function bundleTypeDefinitions(filename: string, outfile: string) {
  // we give the config in its raw form instead of a file
  const extractorConfig = ExtractorConfig.prepare({
    configObject: {
      projectFolder: process.cwd(),
      mainEntryPointFilePath: path.join(process.cwd(), `${filename}.d.ts`),
      bundledPackages: [
        'decimal.js',
        'sql-template-tag',
        '@opentelemetry/api',
        '@prisma/internals',
        '@prisma/engine-core',
        '@prisma/generator-helper',
        '@prisma/debug',
        '@prisma/ni',
      ],
      compiler: {
        tsconfigFilePath: path.join(process.cwd(), 'tsconfig.build.json'),
        overrideTsconfig: {
          compilerOptions: {
            paths: {}, // bug with api extract + paths
          },
        },
      },
      dtsRollup: {
        enabled: true,
        untrimmedFilePath: path.join(process.cwd(), `${outfile}.d.ts`),
      },
      tsdocMetadata: {
        enabled: false,
      },
    },
    packageJsonFullPath: path.join(process.cwd(), 'package.json'),
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

/**
 * Triggers the TypeScript compiler and the type bundler.
 */
export const tscPlugin: (emitTypes?: boolean) => esbuild.Plugin = (emitTypes?: boolean) => ({
  name: 'tscPlugin',
  setup(build) {
    const options = build.initialOptions

    if (emitTypes === false) return // build has opted out of emitting types

    build.onStart(async () => {
      // we only call tsc if not in watch mode or in dev mode (they skip types)
      if (options.incremental !== true && process.env.DEV !== 'true') {
        // --paths null basically prevents typescript from using paths from the
        // tsconfig.json that is passed from the esbuild config. We need to do
        // this because TS would include types from the paths into this build.
        // but our paths, in our specific case only represent separate packages.
        await run(`tsc --project ${options.tsconfig} --paths null`)
      }

      // we bundle types if we also bundle the entry point and it is a ts file
      if (options.bundle === true && options.entryPoints?.[0].endsWith('.ts')) {
        const tsconfig = require(`${process.cwd()}/${options.tsconfig}`) // tsconfig
        const typeOutDir = tsconfig?.compilerOptions?.outDir ?? '.' // type out dir
        const entryPoint = options.entryPoints?.[0].replace(/\.ts$/, '')
        const typeOutPath = `${typeOutDir}/${entryPoint.replace(/^src\//, '')}`
        const bundlePath = options.outfile!.replace(/\.js$/, '')

        if (options.incremental !== true && process.env.DEV !== 'true') {
          // we get the types generated by tsc and bundle them near the output
          bundleTypeDefinitions(typeOutPath, bundlePath)
        } else {
          // in watch mode, it wouldn't be viable to bundle the types every time
          // we haven't built any types with tsc at this stage, but we want types
          // we link the types locally by re-exporting them from the entry point
          await fs.outputFile(`${bundlePath}.d.ts`, `export * from '${process.cwd()}/${entryPoint}'`)
        }
      }
    })
  },
})
