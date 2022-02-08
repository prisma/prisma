import type * as esbuild from 'esbuild'
import { promisify } from 'util'
import fs from 'fs'

const unlink = promisify(fs.unlink)

/**
 * Removes the esm output files after cjs compile.
 * @param build the esbuild build object
 * @returns
 */
function removeIntermediaryEsmFiles(build: esbuild.PluginBuild) {
  const files = Object.values(build.initialOptions.entryPoints ?? {})
  const filesToRemove = files.filter((file) => file.endsWith('.mjs'))
  const fileRemovals = filesToRemove.map((file) => unlink(file))

  return Promise.allSettled(fileRemovals)
}

/**
 * Removes some unnecessary files after compiling.
 */
export const cleanupPlugin: esbuild.Plugin = {
  name: 'cleanupPlugin',
  setup(build) {
    build.onEnd(async () => {
      // we only perform cleanup if when not in watch mode
      if (process.env.WATCH === 'true') return

      await removeIntermediaryEsmFiles(build)
    })
  },
}
