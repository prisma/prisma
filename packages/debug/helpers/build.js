const execa = require('execa')
const esbuild = require('esbuild')
const glob = require('glob')

const ESBUILD_DEFAULT = {
  platform: 'node',
  target: 'es2018',
  sourcemap: 'external',
  format: 'cjs',
  outdir: 'dist',
  tsconfig: 'tsconfig.build.json'
}

async function build() {
  await Promise.all([
    esbuild.build({
      ...ESBUILD_DEFAULT,
      entryPoints: glob.sync('./src/**/*.{j,t}s', {
        ignore: './src/__tests__/**/*'
      })
    }),
  ])

  if (process.env.DEV !== 'true') {
    await run('tsc --build tsconfig.build.json')
  }
}

function run(command, preferLocal = true) {
  return execa.command(command, { preferLocal, shell: true, stdio: 'inherit' })
}

build().catch((e) => {
  console.error(e)
  process.exit(1)
})
