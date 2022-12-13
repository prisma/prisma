import { watch as createWatcher } from 'chokidar'
import * as esbuild from 'esbuild'
import glob from 'globby'
import path from 'path'

import { debounce } from '../blaze/debounce'
import { flatten } from '../blaze/flatten'
import { handle } from '../blaze/handle'
import { map } from '../blaze/map'
import { omit } from '../blaze/omit'
import { pipe } from '../blaze/pipe'
import { transduce } from '../blaze/transduce'
import { depCheckPlugin } from './plugins/depCheckPlugin'
import { fixImportsPlugin } from './plugins/fixImportsPlugin'
import { onErrorPlugin } from './plugins/onErrorPlugin'
import { tscPlugin } from './plugins/tscPlugin'

export type BuildResult = esbuild.BuildResult
export type BuildOptions = esbuild.BuildOptions & {
  name?: string
  emitTypes?: boolean
  outbase?: never // we don't support this
}

const DEFAULT_BUILD_OPTIONS = {
  platform: 'node',
  keepNames: true,
  logLevel: 'error',
  tsconfig: 'tsconfig.build.json',
  incremental: process.env.WATCH === 'true',
  metafile: true,
} as const

/**
 * Apply defaults to allow us to build tree-shaken esm
 * @param options the original build options
 */
const applyCjsDefaults = (options: BuildOptions): BuildOptions => ({
  ...DEFAULT_BUILD_OPTIONS,
  format: 'cjs',
  target: 'es2018',
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
  plugins: [...(options.plugins ?? []), fixImportsPlugin, tscPlugin(options.emitTypes), onErrorPlugin],
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
      () => applyCjsDefaults(options),
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
  return [options, await esbuild.build(omit(options, ['name', 'emitTypes']))] as const
}

/**
 * A blank esbuild run to do an analysis of our deps
 */
async function dependencyCheck(options: BuildOptions) {
  // we only check our dependencies for a full build
  if (process.env.DEV === 'true') return undefined
  // Only run on test and publish pipelines on Buildkite
  // Meaning we skip on GitHub Actions
  // Because it's slow and runs for each job, during setup, making each job slower
  if (process.env.CI && !process.env.BUILDKITE) return undefined

  // we need to bundle everything to do the analysis
  const buildPromise = esbuild.build({
    entryPoints: glob.sync('**/*.{j,t}s', {
      ignore: ['./src/__tests__/**/*', './tests/ecosystem/**/*'],
      gitignore: true,
    }),
    logLevel: 'silent', // there will be errors
    bundle: true, // we bundle to get everything
    write: false, // no need to write for analysis
    outdir: 'out',
    plugins: [depCheckPlugin(options.bundle)],
  })

  // we absolutely don't care if it has any errors
  await buildPromise.catch(() => {})

  return undefined
}

/**
 * Execution pipeline that applies a set of actions
 * @param options
 */
export async function build(options: BuildOptions[]) {
  if (process.env.ECOSYSTEM === 'true') return

  void transduce.async(options, dependencyCheck)

  return transduce.async(
    createBuildOptions(options),
    pipe.async(computeOptions, addExtensionFormat, addDefaultOutDir, executeEsBuild, watch(options)),
  )
}

/**
 * Executes the build and rebuilds what is necessary
 * @param builds
 */
const watch =
  (allOptions: BuildOptions[]) =>
  ([options, result]: readonly [BuildOptions, esbuild.BuildResult | esbuild.BuildIncremental]) => {
    if (process.env.WATCH !== 'true') return result

    // common chokidar options for the watchers
    const config = { ignoreInitial: true, useFsEvents: true, ignored: ['./src/__tests__/**/*'] }

    // prepare the incremental builds watcher
    const watched = getWatchedFiles(result)
    const changeWatcher = createWatcher(watched, config)

    // watcher for restarting a full rebuild
    const restartWatcher = createWatcher(['./src/**/*'], config)

    // triggers quick rebuild on file change
    const fastRebuild = debounce(async () => {
      const timeBefore = Date.now()

      // we handle possible rebuild exceptions
      const rebuildResult = await handle.async(() => {
        return result?.rebuild?.()
      })

      if (rebuildResult instanceof Error) {
        console.error(rebuildResult.message)
      }

      console.log(`${Date.now() - timeBefore}ms [${options.name ?? ''}]`)
    }, 10)

    // triggers a full rebuild on added file
    const fullRebuild = debounce(async () => {
      void changeWatcher.close() // stop all

      // only one watcher will do this task
      if (watchLock === false) {
        watchLock = true
        await build(allOptions)
      }
    }, 10)

    changeWatcher.on('change', fastRebuild)
    restartWatcher.once('add', fullRebuild)
    restartWatcher.once('unlink', fullRebuild)

    return undefined
  }

// Utils ::::::::::::::::::::::::::::::::::::::::::::::::::

// so that only one watcher restarts a full build
let watchLock = false

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

// gets the files to be watched from esbuild
function getWatchedFiles(build: esbuild.BuildIncremental | esbuild.BuildResult | undefined) {
  return Object.keys(build?.metafile?.inputs ?? {})
}
