const execa = require('execa')
const fs = require('fs')
const chalk = require('chalk')
const copy = require('@timsuchanek/copy')
const makeDir = require('make-dir')
const path = require('path')
const {promisify} = require('util')
const copyFile = promisify(fs.copyFile)
const lineReplace = require('line-replace')

async function main() {
  const before = Date.now()

  await makeDir('./build')

  await Promise.all([
    run('node ./scripts/copy-prisma-client.js'),
    run('tsc --build tsconfig.build.json', true),
    run(
      'esbuild src/bin.ts --outfile=build/index.js --bundle --platform=node --target=node10 --minify --sourcemap',
      false,
    ),
    run(
      'esbuild scripts/preinstall.js --outfile=preinstall/index.js --bundle --platform=node --target=node10 --minify',
      false,
    ),
    run(
      'esbuild scripts/download.js --outfile=download-build/index.js --bundle --platform=node --target=node10 --minify',
      false,
    ),
    copy({
      from: path.join(require.resolve('@prisma/studio/package.json'), '../build'),
      to: './build/public',
      recursive: true,
      parallelJobs: process.platform === 'win32' ? 1 : 20,
      overwrite: true
    }),
    copyFile(path.join(require.resolve('checkpoint-client/package.json'), '../dist/child.js'), './build/child.js'),
    copyFile(path.join(require.resolve('open/package.json'), '../xdg-open'), './build/xdg-open'),
  ])

  await Promise.all([
    copy({
      from: path.join(require.resolve('@prisma/studio/package.json'), '../build'),
      to: './dist/public',
      recursive: true,
      parallelJobs: process.platform === 'win32' ? 1 : 20,
      overwrite: true
    }),
    replaceFirstLine('./build/index.js', '#!/usr/bin/env node\n')
  ])

  chmodX('./build/index.js')

  const after = Date.now()
  console.log(
    chalk.blueBright(
      `\nDone with CLI build in ${chalk.bold(
        ((after - before) / 1000).toFixed(1),
      )}s`,
    ),
  )
}

function replaceFirstLine(filePath, line) {
  return new Promise((resolve, reject) => {
    lineReplace({
      file: filePath,
      line: 1,
      text: line,
      addNewLine: false,
      callback: resolve
    })
  })
}

function run(command, preferLocal = true) {
  return execa.command(command, { preferLocal, shell: true, stdio: 'inherit' })
}

main().catch((e) => {
  console.error(e)
  throw e
})


function chmodX(file) {
  const s = fs.statSync(file)
  const newMode = s.mode | 64 | 8 | 1
  if (s.mode === newMode) return
  const base8 = newMode.toString(8).slice(-3)
  fs.chmodSync(file, base8)
}
