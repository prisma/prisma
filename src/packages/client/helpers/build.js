const execa = require('execa')
const chalk = require('chalk')
const esbuild = require('esbuild')

const ESBUILD_DEFAULT = {
  bundle: true,
  platform: 'node',
  target: 'node12',
  external: ['_http_common']
}

async function build() {
  const before = Date.now()

  await Promise.all([
    esbuild.build({
      ...ESBUILD_DEFAULT,
      entryPoints: ['src/generation/generator.ts'],
      outfile: 'generator-build/index.js',
      tsconfig: 'tsconfig.generator.json'
    }),
    esbuild.build({
      ...ESBUILD_DEFAULT,
      entryPoints: ['src/runtime/index.ts'],
      outfile: 'runtime/index.js',
      tsconfig: 'tsconfig.runtime.json'
    }),
    esbuild.build({
      ...ESBUILD_DEFAULT,
      entryPoints: ['src/runtime/index-browser.ts'],
      outfile: 'runtime/index-browser.js',
      tsconfig: 'tsconfig.runtime.json',
      target: ['chrome58', 'firefox57', 'safari11', 'edge16'],
      format: 'cjs',
    }),
  ])

  await run('tsc --build tsconfig.declaration.json')
  await run('rollup -c')

  const after = Date.now()
  console.log(
    chalk.blueBright(
      `\nDone with client build in ${chalk.bold(
        ((after - before) / 1000).toFixed(1),
      )}s`,
    ),
  )
}

function run(command, preferLocal = true) {
  return execa.command(command, { preferLocal, shell: true, stdio: 'inherit' })
}

build().catch((e) => {
  console.error(e)
  process.exit(1)
})
