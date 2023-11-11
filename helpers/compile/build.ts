import { watch as createWatcher } from 'chokidar'
import * as esbuild from 'esbuild'
import { BuildContext } from 'esbuild'
import glob from 'globby'
import { builtinModules } from 'module'

import { debounce } from '../blaze/debounce'
import { handle } from '../blaze/handle'
import { map } from '../blaze/map'
import { omit } from '../blaze/omit'
import { pipe } from '../blaze/pipe'
import { transduce } from '../blaze/transduce'
import { depCheckPlugin } from './plugins/depCheckPlugin'
import { fillPlugin } from './plugins/fill-plugin/fillPlugin'
import { esmPreset } from './plugins/fill-plugin/presets/esm'
import { fixImportsPlugin } from './plugins/fixImportsPlugin'
import { metaFilePlugin } from './plugins/metaFilePlugin'
import { onErrorPlugin } from './plugins/onErrorPlugin'
import { requireToImportPlugin } from './plugins/requireToImportPlugin'
import { tscPlugin } from './plugins/tscPlugin'

export type BuildResult = esbuild.BuildResult
export type BuildOptions = esbuild.BuildOptions & {
  name?: string
  emitTypes?: boolean
  outbase?: never // we don't support this
}

/**
 * Apply sensible defaults to all projects
 * @param options the original build options
 */
const applyDefaults = (options: BuildOptions) => {
  const ext = options.format === 'esm' ? '.mjs' : '.js'

  const defaultOptions: BuildOptions = {
    format: 'cjs',
    platform: 'node',
    target: 'ES2020',
    logLevel: 'error',
    tsconfig: 'tsconfig.build.json',
    outExtension: { '.js': ext },
    resolveExtensions: ['.ts', '.js', '.node'],
    entryPoints: glob.sync('./src/**/*.{j,t}s', {
      ignore: ['./src/__tests__/**/*'],
    }),
    mainFields: ['module', 'main'],
    ...options,
    plugins: [
      ...(options.plugins ?? []),
      fixImportsPlugin,
      tscPlugin(options.emitTypes),
      metaFilePlugin,
      onErrorPlugin,
    ],
  }

  if (options.outfile !== undefined) {
    defaultOptions.outfile = `${options.outfile}${ext}`
  }

  if (options.outfile === undefined) {
    defaultOptions.outdir ??= 'dist'
  }

  if (options.format === 'esm') {
    defaultOptions.plugins?.push(fillPlugin(esmPreset))
    defaultOptions.plugins?.push(requireToImportPlugin(builtinModules))
  }

  return defaultOptions
}

/**
 * We only want to trigger the glob search once we are ready, and that is when
 * the previous build has finished. We get the build options from the deferred.
 */
function computeOptions(options: () => BuildOptions) {
  return options()
}

/**
 * Execute esbuild with all the configurations we pass
 */
async function executeEsBuild(options: BuildOptions) {
  if (process.env.WATCH === 'true') {
    const context = await esbuild.context(omit(options, ['name', 'emitTypes']) as any)

    watch(context, options)
  }

  return [options, await esbuild.build(omit(options, ['name', 'emitTypes']) as any)] as const
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
      // We don't check dependencies in ecosystem tests because tests are isolated from the build.
      ignore: ['./src/__tests__/**/*', './tests/e2e/**/*', './dist/**/*'],
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
  void transduce.async(options, dependencyCheck)

  const lazyDefaultOptions = map(options, (option) => () => applyDefaults(option))
  return transduce.async(lazyDefaultOptions, pipe.async(computeOptions, executeEsBuild))
}

/**
 * Executes the build and rebuilds what is necessary
 * @param builds
 */
const watch = (context: BuildContext, options: BuildOptions) => {
  if (process.env.WATCH !== 'true') return context

  // common chokidar options for the watchers
  const config = { ignoreInitial: true, useFsEvents: true, ignored: ['./src/__tests__/**/*', './package.json'] }

  // prepare the incremental builds watcher
  const changeWatcher = createWatcher(['./src/**/*'], config)

  // triggers quick rebuild on file change
  const fastRebuild = debounce(async () => {
    const timeBefore = Date.now()

    // we handle possible rebuild exceptions
    const rebuildResult = await handle.async(() => {
      return context.rebuild()
    })

    if (rebuildResult instanceof Error) {
      console.error(rebuildResult.message)
    }

    console.log(`${Date.now() - timeBefore}ms [${options.name ?? ''}]`)
  }, 10)

  changeWatcher.on('change', fastRebuild)

  return undefined
}
