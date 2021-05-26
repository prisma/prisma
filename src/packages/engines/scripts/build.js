const execa = require('execa')
const chalk = require('chalk')

async function main() {
  const before = Date.now()

  // TODO: Combine download.ts and index.ts together to save space
  await Promise.all([
    run('tsc -d', true),
    run(
      'esbuild src/download.ts --outfile=download/index.js --bundle --platform=node --target=node10 --minify --sourcemap',
      false,
    ),
    run(
      'esbuild src/index.ts --outfile=dist/index.js --bundle --platform=node --target=node10',
      false,
    ),
  ])

  const after = Date.now()
  console.log(
    chalk.blueBright(
      `\nDone with @prisma/engines build in ${chalk.bold(
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
