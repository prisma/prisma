const execa = require('execa')
const fs = require('fs')
const chalk = require('chalk')
const { promisify } = require('util')
const makeDir = require('make-dir')
const copy = require('@timsuchanek/copy')

const copyFile = promisify(fs.copyFile)

async function main() {
  const before = Date.now()

  // do the job for typescript
  if (
    !fs.existsSync('./runtime-dist') &&
    (fs.existsSync('./tsconfig.runtime.tsbuildinfo') ||
      fs.existsSync('./tsconfig.runtime.esm.tsbuildinfo'))
  ) {
    try {
      console.log('unlinking')
      fs.unlinkSync('./tsconfig.tsbuildinfo')
    } catch (e) {
      console.error(e)
      //
    }
  }

  await Promise.all([makeDir('./runtime-dist/esm'), makeDir('./runtime/esm')])

  await Promise.all([
    // run('tsc --build tsconfig.runtime.esm.json', true),
    run('tsc --build tsconfig.runtime.json', true),
    run('tsc --build tsconfig.json', true),
    run(
      'esbuild src/generator.ts --outfile=generator-build/index.js --bundle --platform=node --target=node10',
      false,
    ),
  ])

  await Promise.all([
    run(
      'esbuild src/runtime/index.ts --outdir=runtime --bundle --platform=node --target=node10',
      false,
    ),
    run(
      'esbuild src/runtime/index.ts --outdir=runtime/esm --bundle --platform=node --target=node10 --format=esm --out-extension:.js=.mjs',
      false,
    ),
    run(
      'esbuild src/runtime/index-browser.ts --format=cjs --outdir=runtime --bundle --target=chrome58,firefox57,safari11,edge16',
      false,
    ),
    run('rollup -c'),
  ])

  await Promise.all([
    copyFile('./runtime/index.d.ts', './runtime/esm/index.d.ts'),
    copyFile('./scripts/backup-index.js', 'index.js'),
    copyFile('./scripts/backup-index-browser.js', 'index-browser.js'),
    copyFile('./scripts/backup-index.d.ts', 'index.d.ts'),
    copyFile('./scripts/backup-index.mjs', 'index.mjs'),
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

// from https://github.com/evanw/esbuild/issues/566#issuecomment-735551834
const externalCjsToEsmPlugin = (external) => ({
  name: 'external',
  setup(build) {
    let escape = (text) => `^${text.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&')}$`
    let filter = new RegExp(external.map(escape).join('|'))
    build.onResolve({ filter: /.*/, namespace: 'external' }, (args) => ({
      path: args.path,
      external: true,
    }))
    build.onResolve({ filter }, (args) => ({
      path: args.path,
      namespace: 'external',
    }))
    build.onLoad({ filter: /.*/, namespace: 'external' }, (args) => ({
      contents: `export * from ${JSON.stringify(args.path)}`,
    }))
  },
})
