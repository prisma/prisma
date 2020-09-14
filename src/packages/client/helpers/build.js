const execa = require('execa')
const fs = require('fs')
const chalk = require('chalk')
const { promisify } = require('util')

const copyFile = promisify(fs.copyFile)
const readFile = promisify(fs.readFile)
const writeFile = promisify(fs.writeFile)

async function main() {
  const before = Date.now()
  const copyPromises = [
    copyFile('./scripts/backup-index.js', 'index.js'),
    copyFile('./scripts/backup-index.d.ts', 'index.d.ts'),
  ]
  await Promise.all([
    run('tsc --build tsconfig.runtime.json'),
    run(
      'esbuild src/generator.ts --outfile=generator-build/index.js --bundle --platform=node --target=node10',
      false,
    ),
  ])
  await Promise.all([
    run('rollup -c'),
    run(
      'esbuild src/runtime/index.ts --outdir=runtime --bundle --platform=node --sourcemap --minify --target=node10',
      false,
    ),
  ])

  await Promise.all(copyPromises)

  // this is needed to remove "export = " statements
  let file = await readFile('./runtime/index.d.ts', 'utf-8')
  file = file.replace(/^export\s+=\s+.*/gm, '')
  await writeFile('./runtime/index.d.ts', file)

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
  console.log(chalk.bold.green(command))
  return execa.command(command, { stdio: 'inherit', preferLocal })
}

main().catch((e) => {
  console.error(e)
  throw e
})
