import execa from 'execa'
import * as esbuild from 'esbuild'
import { flatten } from '../blaze/flatten'
import { pipe } from '../blaze/pipe'
import { map } from '../blaze/map'
import { handle } from '../blaze/handle'
import { transduce } from '../blaze/transduce'
import glob from 'glob'
import path from 'path'

// we first compile everything to esm
export const esmBaseOptions = (
  options: esbuild.BuildOptions,
): esbuild.BuildOptions => ({
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
})

// then we compile all the esm to cjs
export const cjsBaseOptions = (
  options: esbuild.BuildOptions,
): esbuild.BuildOptions => ({
  format: 'cjs',
  platform: 'node',
  target: 'es2018',
  keepNames: true,
  tsconfig: 'tsconfig.build.json',
  outExtension: { '.js': '.js' },
  resolveExtensions: ['.mjs'],
  mainFields: ['module'],
  ...options,
  // we want to compile tree-shaken esm to cjs, so we override
  entryPoints: options.outfile
    ? glob.sync(`./${getEsmOutFile(options)}.mjs`)
    : glob.sync(`./${getEsmOutDir(options)}/**/*.mjs`),
  // outfile has precedence over outdir, hence these ternaries
  outdir: options.outfile ? undefined : getOutDir(options),
})

// create a matrix of possible options with cjs and esm
function combineBaseOptions(options: esbuild.BuildOptions[]) {
  return flatten(
    map(options, (options) => [
      // we defer it so that we don't trigger glob now
      () => esmBaseOptions(options),
      () => cjsBaseOptions(options),
    ]),
  )
}

// only trigger it when ready because of the glob search
function computeOptions(options: () => esbuild.BuildOptions) {
  return handle(() => options())
}

// extensions are not auto set for `outfile`, we do it
function addExtensionFormat(options: esbuild.BuildOptions | Error) {
  if (options instanceof Error) return options

  if (options.outfile && options.outExtension) {
    const ext = options.outExtension['.js']

    options.outfile = `${options.outfile}${ext}`
  }

  return options
}

// automatically default outdir if we have no outfile
function addDefaultOutDir(options: esbuild.BuildOptions | Error) {
  if (options instanceof Error) return options

  if (options.outfile === undefined) {
    options.outdir = getOutDir(options)
  }

  return options
}

// execute esbuild with all the configurations we pass
async function executeEsBuild(options: esbuild.BuildOptions | Error) {
  if (options instanceof Error) return options

  return handle.async(() => esbuild.build(options))
}

// when it's requested we also generate project types
function emitProjectTypes(result?: esbuild.BuildResult | Error) {
  if (result instanceof Error) return result

  if (process.env.DEV !== 'true') {
    return handle.async(() => run('tsc --build tsconfig.build.json'))
  }

  return undefined
}

// detect build errors and exit the process if needed
function handleBuildErrors(result?: Error | execa.ExecaReturnValue) {
  if (result instanceof Error) {
    console.log(result.message)
    process.exit(1)
  }
}

// execution pipeline: options => build => (esm -> cjs)
export function build(options: esbuild.BuildOptions[]) {
  void transduce.async(
    combineBaseOptions(options),
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
function getOutDir(options: esbuild.BuildOptions) {
  if (options.outfile !== undefined) {
    return path.dirname(options.outfile)
  }

  return options.outdir ?? 'dist'
}

// get the esm output path from an original path
function getEsmOutDir(options: esbuild.BuildOptions) {
  return `${getOutDir(options)}/esm`
}

// get the esm output file from an original path
function getEsmOutFile(options: esbuild.BuildOptions) {
  if (options.outfile !== undefined) {
    const dirname = getOutDir(options)
    const filename = path.basename(options.outfile)

    return `${dirname}/esm/${filename}`
  }

  return undefined
}

// wrapper around execa to run our build cmds
function run(command: string) {
  return execa.command(command, {
    preferLocal: true,
    shell: true,
    stdio: 'inherit',
  })
}
