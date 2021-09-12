import execa from 'execa'
import * as esbuild from 'esbuild'
import { flatten } from './blaze/flatten'
import { pipe } from './blaze/pipe'
import { map } from './blaze/map'
import { handle } from './blaze/handle'

export const cjsBaseOptions: esbuild.BuildOptions = {
  format: 'cjs',
  platform: 'node',
  target: 'es2018',
  external: ['_http_common'],
  keepNames: true,
  tsconfig: 'tsconfig.build.json',
  outExtension: { '.js': '.cjs' },
}

export const esmBaseOptions: esbuild.BuildOptions = {
  format: 'esm',
  platform: 'node',
  target: 'es2018',
  external: ['_http_common'],
  keepNames: true,
  tsconfig: 'tsconfig.build.json',
  outExtension: { '.js': '.mjs' },
}

// create a matrix of possible options with cjs and esm
function combineBaseOptions(options: esbuild.BuildOptions[]) {
  return flatten(
    map(options, (options) => [
      { ...cjsBaseOptions, ...options },
      { ...esmBaseOptions, ...options },
    ]),
  )
}

// extensions are not auto set for `outfile`, we do it
function addExtensionFormat(options: esbuild.BuildOptions[]) {
  return map(options, (options) => {
    if (options.outfile && options.outExtension) {
      const ext = options.outExtension['.js']

      options.outfile = `${options.outfile}${ext}`
    }

    return options
  })
}

// execute esbuild with all the configurations we pass
function executeEsBuild(options: esbuild.BuildOptions[]) {
  return map(options, (options) => esbuild.build(options))
}

// when it's requested we also generate project types
async function emitProjectTypes(result: Promise<esbuild.BuildResult>[]) {
  await Promise.all(result) // check that it compiled

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
  void pipe(
    combineBaseOptions,
    addExtensionFormat,
    executeEsBuild,
    emitProjectTypes,
    handleBuildErrors,
  )(options)
}

function run(command: string, preferLocal = true) {
  return execa.command(command, { preferLocal, shell: true, stdio: 'inherit' })
}
