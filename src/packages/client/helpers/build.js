const execa = require('execa')
const fs = require('fs')
const chalk = require('chalk')
const { promisify } = require('util')
const esbuild = require('esbuild')
const copyFile = promisify(fs.copyFile)

async function main() {
  const before = Date.now()

  // do the job for typescript
  if (
    !fs.existsSync('./runtime-dist') &&
    fs.existsSync('./tsconfig.runtime.tsbuildinfo')
  ) {
    try {
      console.log('unlinking')
      fs.unlinkSync('./tsconfig.tsbuildinfo')
    } catch (e) {
      console.error(e)
      //
    }
  }

  await Promise.all([
    run('tsc --build tsconfig.runtime.json', true),
    run('tsc --build tsconfig.json', true),
    esbuild.build({
      platform: 'node',
      bundle: true,
      target: 'node10',
      outfile: 'generator-build/index.js',
      entryPoints: ['src/generator.ts'],
    }),
  ])

  await Promise.all([
    esbuild.build({
      platform: 'node',
      bundle: true,
      target: 'node10',
      outdir: 'runtime',
      entryPoints: ['src/runtime/index.ts'],
    }),
    esbuild.build({
      platform: 'node',
      bundle: true,
      format: 'cjs',
      target: ['chrome58', 'firefox57', 'safari11', 'edge16'],
      outdir: 'runtime',
      entryPoints: ['src/runtime/index-browser.ts'],
    }),
    run('rollup -c'),
  ])

  await Promise.all([
    copyFile('./scripts/backup-index.js', 'index.js'),
    copyFile('./scripts/backup-index-browser.js', 'index-browser.js'),
    copyFile('./scripts/backup-index.d.ts', 'index.d.ts'),
  ])

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

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
