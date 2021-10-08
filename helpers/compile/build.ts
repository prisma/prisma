import execa from 'execa'
import * as esbuild from 'esbuild'
import { flatten } from '../blaze/flatten'
import { pipe } from '../blaze/pipe'
import { map } from '../blaze/map'
import { transduce } from '../blaze/transduce'
import glob from 'glob'
import path from 'path'
import { watch as createWatcher } from 'chokidar'
import { tscPlugin } from './plugins/tscPlugin'
import { onErrorPlugin } from './plugins/onErrorPlugin'
import { fixImportsPlugin } from './plugins/fixImportsPlugin'

export type BuildResult = esbuild.BuildResult
export type BuildOptions = esbuild.BuildOptions & {
  outbase?: never // we don't support this
}

const DEFAULT_BUILD_OPTIONS = {
  platform: 'node',
  keepNames: true,
  logLevel: 'error',
  tsconfig: 'tsconfig.build.json',
  incremental: process.env.WATCH === 'true',
} as const

/**
 * Apply defaults defaults allow us to build tree-shaken esm
 * @param options the original build options
 */
const applyEsmDefaults = (options: BuildOptions): BuildOptions => ({
  ...DEFAULT_BUILD_OPTIONS,
  format: 'esm',
  target: 'esnext',
  outExtension: { '.js': '.mjs' },
  resolveExtensions: ['.ts', '.js', '.mjs', '.node'],
  entryPoints: glob.sync('./src/**/*.{j,t}s', {
    ignore: ['./src/__tests__/**/*'],
  }),
  mainFields: ['module', 'main'],
  ...options,
  // outfile has precedence over outdir, hence these ternaries
  outfile: options.outfile ? getEsmOutFile(options) : undefined,
  outdir: options.outfile ? undefined : getEsmOutDir(options),
  plugins: [...(options.plugins ?? []), onErrorPlugin, fixImportsPlugin],
})

/**
 * Apply defaults to allow to compile tree-shaken esm to cjs
 * @param options the original build options
 */
const applyCjsDefaults = (options: BuildOptions): BuildOptions => ({
  ...DEFAULT_BUILD_OPTIONS,
  format: 'cjs',
  target: 'es2018',
  outExtension: { '.js': '.js' },
  resolveExtensions: ['.mjs'],
  mainFields: ['module'],
  ...options,
  // override the path to point it to the previously built esm
  entryPoints: options.outfile
    ? glob.sync(`./${getEsmOutFile(options)}.mjs`)
    : glob.sync(`./${getEsmOutDir(options)}/**/*.mjs`),
  // outfile has precedence over outdir, hence these ternaries
  outdir: options.outfile ? undefined : getOutDir(options),
  // we only produce typescript types on the second run (cjs)
  plugins: [...(options.plugins ?? []), tscPlugin, onErrorPlugin],
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
      () => applyEsmDefaults(options),
      () => applyCjsDefaults(options),
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
  return esbuild.build(options)
}

/**
 * Execution pipeline that applies a set of actions
 * @param options
 */
async function executeBuild(options: BuildOptions[]) {
  return transduce.async(
    createBuildOptions(options),
    pipe.async(
      computeOptions,
      addExtensionFormat,
      addDefaultOutDir,
      executeEsBuild,
    ),
  )
}

/**
 * Executes the build and starts a watcher if needed
 * @param options
 */
export async function build(options: BuildOptions[]) {
  const builds = await executeBuild(options)

  if (process.env.WATCH) watch(builds)
}

/**
 * Executes the build and rebuilds what is necessary
 * @param builds
 */
function watch(builds: esbuild.BuildResult[]) {
  const watcher = createWatcher(
    ['src/**/*.{j,t}s', 'node_modules/@prisma/*/{dist,build,runtime}/*'],
    {
      ignored: ['src/__tests__/**/*', '**/{dist,build,runtime}/*.d.ts'],
      ignoreInitial: true,
    },
  )

  let rebuilding = false
  watcher.on('all', async () => {
    if (rebuilding) return

    rebuilding = true
    console.time('rebuild')
    for (const build of builds) {
      await build.rebuild?.()
    }
    console.timeEnd('rebuild')
    rebuilding = false
  })
}

// Utils ::::::::::::::::::::::::::::::::::::::::::::::::::

// get a default directory if needed (no outfile)
function getOutDir(options: BuildOptions) {
  if (options.outfile !== undefined) {
    return path.dirname(options.outfile)
  }

  return options.outdir ?? 'dist'
}

// get the esm output path from an original path
function getEsmOutDir(options: BuildOptions) {
  return `${getOutDir(options)}/esm`
}

// get the esm output file from an original path
function getEsmOutFile(options: BuildOptions) {
  if (options.outfile !== undefined) {
    const dirname = getOutDir(options)
    const filename = path.basename(options.outfile)

    return `${dirname}/esm/${filename}`
  }

  return undefined
}

// wrapper around execa to run our build cmds
export function run(command: string) {
  return execa.command(command, {
    preferLocal: true,
    shell: true,
    stdio: 'inherit',
  })
}
