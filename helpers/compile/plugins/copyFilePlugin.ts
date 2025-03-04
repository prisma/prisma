import type { Plugin } from 'esbuild'
import fs from 'node:fs/promises'

/**
 * Copies the specified files after the build is done.
 */
const copyFilePlugin = (actions: { from: string; to: string }[]): Plugin => ({
  name: 'copyFilePlugin',
  setup(build) {
    build.onEnd(async () => {
      for (const action of actions) {
        await fs.copyFile(action.from, action.to)
      }
    })
  },
})

export { copyFilePlugin }
