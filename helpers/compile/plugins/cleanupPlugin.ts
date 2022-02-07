import type * as esbuild from 'esbuild'
import { unlink } from 'fs/promises'

function removeIntermediaryEsmFiles(build: esbuild.PluginBuild) {
  // remove the esm output directory after cjs compile
  const files = Object.values(build.initialOptions.entryPoints ?? {})
  const rms = files.map((file) => file.endsWith('.mjs') && unlink(file))

  return Promise.allSettled(rms)
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
