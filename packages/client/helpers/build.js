const execa = require('execa')
const esbuild = require('esbuild')
const fs = require('fs-extra')
const path = require('path')

const ESBUILD_DEFAULT = {
  bundle: true,
  platform: 'node',
  target: 'es2018',
  // external: ['_http_common'],
  tsconfig: 'tsconfig.build.json',
}

async function build() {
  await Promise.all([
    esbuild.build({
      ...ESBUILD_DEFAULT,
      entryPoints: ['src/generation/generator.ts'],
      outfile: 'generator-build/index.js',
    }),
    esbuild.build({
      ...ESBUILD_DEFAULT,
      entryPoints: ['src/runtime/index.ts'],
      outfile: 'runtime/index.js',
    }),
    esbuild.build({
      ...ESBUILD_DEFAULT,
      entryPoints: ['src/runtime/index-browser.ts'],
      outfile: 'runtime/index-browser.js',
      target: ['chrome58', 'firefox57', 'safari11', 'edge16'],
      format: 'cjs',
    }),
    // copy wasm files, etc necessary for undici
    fs.copy(
      path.resolve(
        __dirname,
        '../node_modules/@prisma/engine-core/node_modules/undici/lib/llhttp',
      ),
      path.resolve(__dirname, '../runtime/llhttp'),
    ),
  ])

  if (process.env.DEV !== 'true') {
    await run('tsc --build tsconfig.build.json')
    await run('rollup -c')
  }
}

function run(command, preferLocal = true) {
  return execa.command(command, { preferLocal, shell: true, stdio: 'inherit' })
}

build().catch((e) => {
  console.error(e)
  process.exit(1)
})
