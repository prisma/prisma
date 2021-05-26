const execa = require('execa')
const chalk = require('chalk')
const esbuild = require('esbuild')

async function main() {
  const before = Date.now()

  // TODO: Combine download.ts and index.ts together to save space
  await Promise.all([
    run('tsc -d', true),
    esbuild.build({
      platform: 'node',
      bundle: true,
      target: 'node10',
      outfile: 'download/index.js',
      entryPoints: ['src/download.ts'],
      sourcemap: true,
      minify: true,
    }),
    esbuild.build({
      platform: 'node',
      bundle: true,
      target: 'node10',
      outfile: 'dist/index.js',
      entryPoints: ['src/index.ts'],
      sourcemap: true,
      minify: true,
    }),
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
