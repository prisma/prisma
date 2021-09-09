import execa from 'execa'
import * as esbuild from 'esbuild'

export const cjsBuildOptions: esbuild.BuildOptions = {
  format: 'cjs',
  platform: 'node',
  target: 'es2018',
  external: ['_http_common'],
  keepNames: true,
  tsconfig: 'tsconfig.build.json',
}

export const esmBuildOptions: esbuild.BuildOptions = {
  format: 'esm',
  platform: 'node',
  target: 'es2018',
  external: ['_http_common'],
  keepNames: true,
  tsconfig: 'tsconfig.build.json',
}

function process 

export async function build(
  options: esbuild.BuildOptions[],
  buildTypes = true,
) {
  try {
    // we let esbuild process all configs we passed
    await Promise.all(
      options
        // we create a matrix of cjs and esm config
        .flatMap((options) => [
          { ...cjsBuildOptions, ...options },
          { ...esmBuildOptions, ...options },
        ])
        // that we re-map to add some extra config
        .map((options) => {
          // we determine the output file extension
          const ext = options.format === 'esm' ? '.mjs' : '.cjs'

          // when using `outdir`, this will set it
          options.outExtension = { '.js': ext }

          if (options.outfile) {
            // but not for `outfile`, so we set it
            options.outfile = `${options.outfile}${ext}`
          }

          return esbuild.build(options) // build
        }),
    )

    // when it's requested, we also generate ts types
    if (buildTypes && process.env.DEV !== 'true') {
      await run('tsc --build tsconfig.build.json')
    }
  } catch (e) {
    console.log(e)
    process.exit(1)
  }
}

function run(command, preferLocal = true) {
  return execa.command(command, { preferLocal, shell: true, stdio: 'inherit' })
}
