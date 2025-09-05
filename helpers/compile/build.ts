import * as esbuild from 'esbuild'
import { writeFileSync } from 'fs'
import glob from 'globby'
import path from 'path'

import { flatten } from '../blaze/flatten'
import { map } from '../blaze/map'
import { omit } from '../blaze/omit'
import { pipe } from '../blaze/pipe'
import { transduce } from '../blaze/transduce'
import { fixImportsPlugin } from './plugins/fixImportsPlugin'
import { onErrorPlugin } from './plugins/onErrorPlugin'
import { resolvePathsPlugin } from './plugins/resolvePathsPlugin'
import { tscPlugin } from './plugins/tscPlugin'

export type BuildResult = esbuild.BuildResult
export type BuildOptions = esbuild.BuildOptions & {
  name?: string
  emitTypes?: boolean
  emitMetafile?: boolean
  outbase?: never // we don't support this
}

const DEFAULT_BUILD_OPTIONS = {
  platform: 'node',
  target: 'ES2022',
  logLevel: 'error',
  tsconfig: 'tsconfig.build.json',
  metafile: true,
} as const

/**
 * Apply defaults to the original build options
 * @param options the original build options
 */
const applyDefaults = (options: BuildOptions): BuildOptions => ({
  ...DEFAULT_BUILD_OPTIONS,
  format: 'cjs',
  outExtension: { '.js': '.js' },
  resolveExtensions: ['.ts', '.js', '.node'],
  entryPoints: glob.sync('./src/**/*.{j,t}s', {
    ignore: ['./src/__tests__/**/*'],
  }),
  mainFields: ['module', 'main'],
  ...options,
  // outfile has precedence over outdir, hence these ternaries
  outfile: options.outfile ? getOutFile(options) : undefined,
  outdir: options.outfile ? undefined : getOutDir(options),
  plugins: [
    ...(options.plugins ?? []),
    resolvePathsPlugin,
    fixImportsPlugin,
    tscPlugin(options.emitTypes),
    onErrorPlugin,
  ],
  external: [...(options.external ?? []), ...getProjectExternals(options)],
})

/**
 * Create two deferred builds for esm and cjs. The one follows the other:
 * - 1. The code gets compiled to an optimized tree-shaken esm output
 * - 2. We take that output and compile it to an optimized cjs output
 * @param options the original build options
 * @returns if options = [a, b], we get [a-esm, a-cjs, b-esm, b-cjs]
 */
function createBuildOptions(options: BuildOptions[]) {
  return flatten(
    map(options, (options) => [
      // we defer it so that we don't trigger glob immediately
      () => applyDefaults(options),
      // ... here can go more steps
    ]),
  )
}

/**
 * We only want to trigger the glob search once we are ready, and that is when
 * the previous build has finished. We get the build options from the deferred.
 */
function computeOptions(options: () => BuildOptions) {
  return options()
}

/**
 * Extensions are not automatically by esbuild set for `options.outfile`. We
 * look at the set `options.outExtension` and we add that to `options.outfile`.
 */
function addExtensionFormat(options: BuildOptions) {
  if (options.outfile && options.outExtension) {
    const ext = options.outExtension['.js']

    options.outfile = `${options.outfile}${ext}`
  }

  return options
}

/**
 * If we don't have `options.outfile`, we default `options.outdir`
 */
function addDefaultOutDir(options: BuildOptions) {
  if (options.outfile === undefined) {
    options.outdir = getOutDir(options)
  }

  return options
}

/**
 * Execute esbuild with all the configurations we pass
 */
async function executeEsBuild(options: BuildOptions) {
  const build = await esbuild.build(omit(options, ['name', 'emitTypes', 'emitMetafile']) as any)
  const outdir = options.outdir ?? (options.outfile ? path.dirname(options.outfile) : undefined)

  if (build.metafile && options.emitMetafile) {
    const metafilePath = `${outdir}/${options.name}.meta.json`
    writeFileSync(metafilePath, JSON.stringify(build.metafile))
  }

  return [options, build] as const
}

/**
 * Execution pipeline that applies a set of actions
 * @param options
 */
export async function build(options: BuildOptions[]) {
  return transduce.async(
    createBuildOptions(options),
    pipe.async(computeOptions, logStartBuild, addExtensionFormat, addDefaultOutDir, executeEsBuild),
  )
}

/**
 * Prints a message every time a new bundle is built
 */
function logStartBuild(options: BuildOptions): BuildOptions {
  console.log(`Building ${options.name} as ${options.format ?? 'cjs'}...`)
  return options
}

// Utils ::::::::::::::::::::::::::::::::::::::::::::::::::

// get a default directory if needed (no outfile)
function getOutDir(options: BuildOptions) {
  if (options.outfile !== undefined) {
    return path.dirname(options.outfile)
  }

  return options.outdir ?? 'dist'
}

// get the output file from an original path
function getOutFile(options: BuildOptions) {
  if (options.outfile !== undefined) {
    const dirname = getOutDir(options)
    const filename = path.basename(options.outfile)

    return `${dirname}/${filename}`
  }

  return undefined
}

// get the current project externals this helps to mark dependencies as external
// by having convention in the package.json (dev = bundled, non-dev = external)
function getProjectExternals(options: BuildOptions) {
  const pkg = require(`${process.cwd()}/package.json`)
  const peerDeps = Object.keys(pkg.peerDependencies ?? {})
  const regDeps = Object.keys(pkg.dependencies ?? {})

  // when bundling, only the devDeps will be bundled
  if (!process.env.IGNORE_EXTERNALS && options.bundle === true) {
    return [...new Set([...peerDeps, ...regDeps])]
  }

  // otherwise, all the dependencies will be bundled
  return []
}
