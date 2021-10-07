import type { BuildOptions } from '../../../helpers/compile/build'
import { run } from '../../../helpers/compile/build'
import { build } from '../../../helpers/compile/build'
import copy from '@timsuchanek/copy'
import path from 'path'
import type * as esbuild from 'esbuild'
import fs from 'fs'
import { promisify } from 'util'
import lineReplace from 'line-replace'

const copyFile = promisify(fs.copyFile)

/**
 * The CLI wants to bundle everything, including @prisma/sdk and @prisma/studio.
 * For that reason, it sets all its dependencies as devDependencies.
 *
 * Problem: @prisma/studio has a peerDependency to @prisma/sdk. Because the CLI
 * doesn't have @prisma/sdk as dependency, but rather a devDependency, esbuild
 * will bundle @prisma/studio but mark its imports to @prisma/sdk as external.
 *
 * Solution: Since that is not our intent, and we want @prisma/studio to share
 * the same @prisma/sdk version that is bundled in the CLI, we have this plugin.
 */
const resolveHelperPlugin: esbuild.Plugin = {
  name: 'resolveHelperPlugin',
  setup(build) {
    // for any import of @prisma/sdk, resolve to this one
    build.onResolve({ filter: /^@prisma\/sdk$/ }, () => {
      return { path: require.resolve('@prisma/sdk') }
    })
    // similar issue for spdx packages coming from pkg-up
    build.onResolve({ filter: /^spdx-exceptions/ }, () => {
      return { path: require.resolve('spdx-exceptions') }
    })
    build.onResolve({ filter: /^spdx-license-ids/ }, () => {
      return { path: require.resolve('spdx-license-ids') }
    })
  },
}

/**
 * Manages the extra actions that are needed for the CLI to work
 */
const cliLifecyclePlugin: esbuild.Plugin = {
  name: 'cliLifecyclePlugin',
  setup(build) {
    build.onStart(async () => {
      // provide a copy of the client for studio to work
      await run('node ./helpers/copy-prisma-client.js')
    })

    build.onEnd(async (result) => {
      // we only proceed with this for the second build
      if (build.initialOptions?.format !== 'cjs') return

      // and only proceed if there were no build errors
      if (result.errors.length > 0) return

      // we copy the contents from @prisma/studio to build
      await copy({
        from: path.join(
          require.resolve('@prisma/studio/package.json'),
          '../dist',
        ),
        to: './build/public',
        parallelJobs: process.platform === 'win32' ? 1 : 20,
        recursive: true,
        overwrite: true,
      })

      // we copy the contents from checkpoint-client to build
      await copyFile(
        path.join(
          require.resolve('checkpoint-client/package.json'),
          '../dist/child.js',
        ),
        './build/child.js',
      )

      // we copy the contents from xdg-open to build
      await copyFile(
        path.join(require.resolve('open/package.json'), '../xdg-open'),
        './build/xdg-open',
      )

      await replaceFirstLine('./build/index.js', '#!/usr/bin/env node\n')

      chmodX('./build/index.js')
    })
  },
}

// we define the config for cli
const cliBuildConfig: BuildOptions = {
  entryPoints: ['src/bin.ts'],
  outfile: 'build/index',
  external: ['@prisma/engines', '_http_common'],
  plugins: [resolveHelperPlugin, cliLifecyclePlugin],
  bundle: true,
}

// we define the config for preinstall
const preinstallBuildConfig: BuildOptions = {
  entryPoints: ['scripts/preinstall.js'],
  outfile: 'preinstall/index',
  bundle: true,
}

// we define the config for install
const installBuildConfig: BuildOptions = {
  entryPoints: ['scripts/install.js'],
  outfile: 'install/index',
  bundle: true,
  minify: true,
}

void build([cliBuildConfig, preinstallBuildConfig, installBuildConfig])
// async function main() {
//   await esbuild.build(cliBuildConfig)
//   await esbuild.build(preinstallBuildConfig)
//   await esbuild.build(installBuildConfig)
// }

// void main()

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
