import type * as esbuild from 'esbuild'
import fs from 'fs'
import { copy } from 'fs-extra'
import lineReplace from 'line-replace'
import path from 'path'
import { promisify } from 'util'

import type { BuildOptions } from '../../../helpers/compile/build'
import { build } from '../../../helpers/compile/build'
import { run } from '../../../helpers/compile/run'

const copyFile = promisify(fs.copyFile)

/**
 * Manages the extra actions that are needed for the CLI to work
 */
const cliLifecyclePlugin: esbuild.Plugin = {
  name: 'cliLifecyclePlugin',
  setup(build) {
    // we only do this for the first one of the builds
    if (build.initialOptions?.format === 'esm') return

    build.onStart(async () => {
      // provide a copy of the client for studio to work
      await run('node -r esbuild-register ./helpers/copy-prisma-client.ts')
    })

    build.onEnd(async () => {
      // we copy the contents from @prisma/studio to build
      await copy(path.join(require.resolve('@prisma/studio/package.json'), '../dist'), './build/public', {
        recursive: true,
        overwrite: true,
      })

      // we copy the contents from checkpoint-client to build
      await copyFile(
        path.join(require.resolve('checkpoint-client/package.json'), '../dist/child.js'),
        './build/child.js',
      )

      // we copy the contents from xdg-open to build
      await copyFile(path.join(require.resolve('open/package.json'), '../xdg-open'), './build/xdg-open')

      // as a convention, we install all Prisma's Wasm modules in the internals package
      const wasmResolveDir = path.join(__dirname, '..', '..', 'internals', 'node_modules')

      // TODO: create a glob helper for this to import all the wasm modules having pattern /^@prisma\/.*-wasm$/
      const prismaWasmFile = path.join(wasmResolveDir, '@prisma', 'prisma-fmt-wasm', 'src', 'prisma_fmt_build_bg.wasm')
      await copyFile(prismaWasmFile, './build/prisma_fmt_build_bg.wasm')

      await replaceFirstLine('./build/index.js', '#!/usr/bin/env node\n')

      chmodX('./build/index.js')
    })
  },
}

// we define the config for cli
const cliBuildConfig: BuildOptions = {
  name: 'cli',
  entryPoints: ['src/bin.ts'],
  outfile: 'build/index',
  external: ['@prisma/engines'],
  plugins: [cliLifecyclePlugin],
  bundle: true,
  metafile: true,
  emitTypes: false,
}

// we define the config for preinstall
const preinstallBuildConfig: BuildOptions = {
  name: 'preinstall',
  entryPoints: ['scripts/preinstall.js'],
  outfile: 'preinstall/index',
  bundle: true,
  metafile: true,
  emitTypes: false,
}

// we define the config for install
const installBuildConfig: BuildOptions = {
  name: 'install',
  entryPoints: ['scripts/install.js'],
  outfile: 'install/index',
  bundle: true,
  metafile: true,
  minify: true,
  emitTypes: false,
}

void build([cliBuildConfig, preinstallBuildConfig, installBuildConfig])

// Utils ::::::::::::::::::::::::::::::::::::::::::::::::::

function chmodX(filename: string) {
  const s = fs.statSync(filename)
  const newMode = s.mode | 64 | 8 | 1
  if (s.mode === newMode) return
  const base8 = newMode.toString(8).slice(-3)
  fs.chmodSync(filename, base8)
}

function replaceFirstLine(filename: string, line: string) {
  return new Promise((resolve) => {
    lineReplace({
      file: filename,
      line: 1,
      text: line,
      addNewLine: false,
      callback: resolve,
    })
  })
}
