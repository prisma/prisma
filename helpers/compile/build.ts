import execa from 'execa'
import * as esbuild from 'esbuild'
import { flatten } from '../blaze/flatten'
import { pipe } from '../blaze/pipe'
import { map } from '../blaze/map'
import { handle } from '../blaze/handle'
import { transduce } from '../blaze/transduce'
import glob from 'glob'

export const cjsBaseOptions = (): esbuild.BuildOptions => ({
  format: 'cjs',
  platform: 'node',
  target: 'es2018',
  keepNames: true,
  tsconfig: 'tsconfig.build.json',
  outExtension: { '.js': '.js' },
  resolveExtensions: ['.ts', '.js', '.mjs', '.node'],
  entryPoints: glob.sync('./dist/**/*.mjs'),
  mainFields: ['main', 'module'],
})

export const esmBaseOptions = (): esbuild.BuildOptions => ({
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
})

// create a matrix of possible options with cjs and esm
function combineBaseOptions(options: esbuild.BuildOptions[]) {
  return flatten(
    map(options, (options) => [
      { ...esmBaseOptions(), ...options },
      { ...cjsBaseOptions(), ...options },
    ]),
  )
}

// extensions are not auto set for `outfile`, we do it
function addExtensionFormat(options: esbuild.BuildOptions) {
  if (options.outfile && options.outExtension) {
    const ext = options.outExtension['.js']

    options.outfile = `${options.outfile}${ext}`
  }

  return options
}

// automatically default outdir if we have no outfile
function addDefaultOutDir(options: esbuild.BuildOptions) {
  if (options.outfile === undefined) {
    options.outdir = 'dist'
  }

  return options
}

// execute esbuild with all the configurations we pass
function executeEsBuild(options: esbuild.BuildOptions) {
  return handle.async(() => esbuild.build(options))
}

// when it's requested we also generate project types
function emitProjectTypes(result?: Error | esbuild.BuildResult) {
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

export function build(options: esbuild.BuildOptions[]) {
  void transduce.async(
    combineBaseOptions(options),
    pipe.async(
      addExtensionFormat,
      addDefaultOutDir,
      executeEsBuild,
      emitProjectTypes,
      handleBuildErrors,
    ),
  )
}

function run(command: string) {
  return execa.command(command, {
    preferLocal: true,
    shell: true,
    stdio: 'inherit',
  })
}
