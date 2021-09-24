import execa from 'execa'
import * as esbuild from 'esbuild'
import { flatten } from '../blaze/flatten'
import { pipe } from '../blaze/pipe'
import { map } from '../blaze/map'
import { handle } from '../blaze/handle'
import { transduce } from '../blaze/transduce'
import glob from 'glob'
import path from 'path'

export type BuildResult = esbuild.BuildResult
export type BuildOptions = esbuild.BuildOptions & {
  emitProjectTypes?: boolean
  outbase?: never // we don't support this
}

/**
 * Apply defaults defaults allow us to build tree-shaken esm
 * @param options the original build options
 */
const applyEsmDefaults = (options: BuildOptions): BuildOptions => ({
  format: 'esm',
  platform: 'node',
  target: 'es2018',
  keepNames: true,
  tsconfig: 'tsconfig.build.json',
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
  emitProjectTypes: false, // just build it on the next pass
})

/**
 * Apply defaults to allow to compile tree-shaken esm to cjs
 * @param options the original build options
 */
const applyCjsDefaults = (options: BuildOptions): BuildOptions => ({
  format: 'cjs',
  platform: 'node',
  target: 'es2018',
  keepNames: true,
  tsconfig: 'tsconfig.build.json',
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
  emitProjectTypes: process.env.DEV !== 'true',
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
  return handle(() => options())
}

/**
 * Extensions are not automatically by esbuild set for `options.outfile`. We
 * look at the set `options.outExtension` and we add that to `options.outfile`.
 */
function addExtensionFormat(options: BuildOptions | Error) {
  if (options instanceof Error) return options

  if (options.outfile && options.outExtension) {
    const ext = options.outExtension['.js']

    options.outfile = `${options.outfile}${ext}`
  }

  return options
}

/**
 * If we don't have `options.outfile`, we default `options.outdir`
 */
function addDefaultOutDir(options: BuildOptions | Error) {
  if (options instanceof Error) return options

  if (options.outfile === undefined) {
    options.outdir = getOutDir(options)
  }

  return options
}

/**
 * Execute esbuild with all the configurations we pass
 */
async function executeEsBuild(options: BuildOptions | Error) {
  if (options instanceof Error) return options

  const result = await handle.async(() => {
    return esbuild.build(stripOwnOptions(options))
  })

  if (result instanceof Error) return result

  return options
}

/**
 * When it's requested we also generate project types
 */
function emitProjectTypes(options: BuildOptions | Error) {
  if (options instanceof Error) return options

  if (options.emitProjectTypes === true) {
    return handle.async(() => run(`tsc --build ${options.tsconfig}`))
  }

  return undefined
}

/**
 * Detect build errors and exit the process if needed
 */
function handleBuildErrors(result?: Error | execa.ExecaReturnValue) {
  if (result instanceof Error) {
    console.log(result.message)
    process.exit(1)
  }
}

/**
 * Execution pipeline that applies a set actions
 * @param options
 */
export function build(options: BuildOptions[]) {
  return transduce.async(
    createBuildOptions(options),
    pipe.async(
      computeOptions,
      addExtensionFormat,
      addDefaultOutDir,
      executeEsBuild,
      emitProjectTypes,
      handleBuildErrors,
    ),
  )
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

// remove our options from the esbuild options
function stripOwnOptions(options: BuildOptions) {
  const _options = { ...options }

  delete _options.emitProjectTypes

  return _options
}

// wrapper around execa to run our build cmds
export function run(command: string) {
  return execa.command(command, {
    preferLocal: true,
    shell: true,
    stdio: 'inherit',
  })
}
