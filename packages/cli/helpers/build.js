const execa = require('execa')
const fs = require('fs')
const chalk = require('chalk')
const copy = require('@timsuchanek/copy')
const makeDir = require('make-dir')
const path = require('path')
const esbuild = require('esbuild')
const { promisify } = require('util')
const copyFile = promisify(fs.copyFile)
const lineReplace = require('line-replace')

const ESBUILD_DEFAULT = {
  platform: 'node',
  target: 'es2018',
  bundle: true,
  tsconfig: 'tsconfig.build.json'
}

async function main() {
  const before = Date.now()

  await makeDir('./build')

  await run('node ./helpers/copy-prisma-client.js')

  await Promise.all([
    esbuild.build({
      ...ESBUILD_DEFAULT,
      entryPoints: ['src/bin.ts'],
      outfile: 'build/index.js',
      external: ['@prisma/engines', '_http_common'],
    }),
    esbuild.build({
      ...ESBUILD_DEFAULT,
      entryPoints: ['scripts/preinstall.js'],
      outfile: 'preinstall/index.js',
    }),
    esbuild.build({
      ...ESBUILD_DEFAULT,
      entryPoints: ['scripts/install.js'],
      outfile: 'install/index.js',
      minify: true,
    }),
    copy({
      from: path.join(
        require.resolve('@prisma/studio-server/package.json'),
        '../public',
      ),
      to: './build/public',
      recursive: true,
      parallelJobs: process.platform === 'win32' ? 1 : 20,
      overwrite: true,
    }),
    copyFile(
      path.join(
        require.resolve('checkpoint-client/package.json'),
        '../dist/child.js',
      ),
      './build/child.js',
    ),
    copyFile(
      path.join(require.resolve('open/package.json'), '../xdg-open'),
      './build/xdg-open',
    ),
  ])

  await Promise.all([
    replaceFirstLine('./build/index.js', '#!/usr/bin/env node\n'),
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
  return new Promise((resolve) => {
    lineReplace({
      file: filePath,
      line: 1,
      text: line,
      addNewLine: false,
      callback: resolve,
    })
  })
}

function run(command, preferLocal = true) {
  return execa.command(command, { preferLocal, shell: true, stdio: 'inherit' })
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})

function chmodX(file) {
  const s = fs.statSync(file)
  const newMode = s.mode | 64 | 8 | 1
  if (s.mode === newMode) return
  const base8 = newMode.toString(8).slice(-3)
  fs.chmodSync(file, base8)
}
