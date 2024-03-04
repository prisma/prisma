import type * as esbuild from 'esbuild'
import fs from 'fs'
import { copy } from 'fs-extra'
import lineReplace from 'line-replace'
import path from 'path'

import type { BuildOptions } from '../../../helpers/compile/build'
import { build } from '../../../helpers/compile/build'
import { copyPrismaClient } from './copy-prisma-client'

/**
 * Manages the extra actions that are needed for the CLI to work
 */
const cliLifecyclePlugin: esbuild.Plugin = {
  name: 'cliLifecyclePlugin',
  setup(build) {
    // provide a copy of the client for studio to work
    build.onStart(copyPrismaClient)

    build.onEnd(async () => {
      // we copy the contents from @prisma/studio to build
      await copy(path.join(require.resolve('@prisma/studio/package.json'), '../dist'), './build/public', {
        recursive: true,
        overwrite: true,
      })

      // we copy the contents from checkpoint-client to build
      await fs.promises.copyFile(
        path.join(require.resolve('checkpoint-client/package.json'), '../dist/child.js'),
        './build/child.js',
      )

      // we copy the contents from xdg-open to build
      await fs.promises.copyFile(path.join(require.resolve('open/package.json'), '../xdg-open'), './build/xdg-open')

      // as a convention, we install all Prisma's Wasm modules in the internals package
      const wasmResolveDir = path.join(__dirname, '..', '..', 'internals', 'node_modules')

      // TODO: create a glob helper for this to import all the wasm modules having pattern /^@prisma\/.*-wasm$/
      const prismaWasmFile = path.join(
        wasmResolveDir,
        '@prisma',
        'prisma-schema-wasm',
        'src',
        'prisma_schema_build_bg.wasm',
      )
      await fs.promises.copyFile(prismaWasmFile, './build/prisma_schema_build_bg.wasm')

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
  plugins: [cliLifecyclePlugin],
  bundle: true,
  emitTypes: false,
  minify: true,
}

// we define the config for preinstall
const preinstallBuildConfig: BuildOptions = {
  name: 'preinstall',
  entryPoints: ['scripts/preinstall.ts'],
  outfile: 'preinstall/index',
  bundle: true,
  emitTypes: false,
  minify: true,
}

void build([cliBuildConfig, preinstallBuildConfig])

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
