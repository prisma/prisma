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
  entryPoints: glob.sync('./src/**/*.{j,t}s', {
    ignore: ['./src/__tests__/**/*'],
  }),
})

export const esmBaseOptions = (): esbuild.BuildOptions => ({
  format: 'esm',
  platform: 'node',
  target: 'es2018',
  keepNames: true,
  tsconfig: 'tsconfig.build.json',
  outExtension: { '.js': '.mjs' },
  entryPoints: glob.sync('./src/**/*.{j,t}s', {
    ignore: ['./src/__tests__/**/*'],
  }),
  resolveExtensions: ['.ts', '.js', '.mjs', '.node'],

  // bundle: true,
  // outfile: 'dist/index',
  mainFields: ['module', 'main'],
  // plugins: [makeAllPackagesExternalPlugin],
})

// create a matrix of possible options with cjs and esm
function combineBaseOptions(options: esbuild.BuildOptions[]) {
  return flatten(
    map(options, (options) => [
      { ...cjsBaseOptions(), ...options },
      // { ...esmBaseOptions(), ...options },
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
  return esbuild.build(options)
}

// when it's requested we also generate project types
async function emitProjectTypes(result: Promise<esbuild.BuildResult>) {
  await result // check that it compiled

  if (process.env.DEV !== 'true') {
    await run('tsc --build tsconfig.build.json')
  }

  return undefined
}

// detect build errors and exit the process if needed
async function handleBuildErrors(promise: Promise<void>) {
  const result = await handle(() => promise)

  if (result instanceof Error) {
    console.log(result)
    process.exit(1)
  }
}

export function build(options: esbuild.BuildOptions[]) {
  transduce(
    combineBaseOptions(options),
    pipe(
      addExtensionFormat,
      addDefaultOutDir,
      executeEsBuild,
      emitProjectTypes,
      handleBuildErrors,
    ),
  )
}

function run(command: string, preferLocal = true) {
  return execa.command(command, { preferLocal, shell: true, stdio: 'inherit' })
}

// taken from https://github.com/evanw/esbuild/issues/619
const makeAllPackagesExternalPlugin = {
  name: 'make-all-packages-external',
  setup(build) {
    const filter = /^[^.\/]|^\.[^.\/]|^\.\.[^\/]/ // Must not start with "/" or "./" or "../"
    build.onResolve({ filter }, (args) => ({ path: args.path, external: true }))
  },
}
