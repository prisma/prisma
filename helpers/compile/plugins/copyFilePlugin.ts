import type { Plugin } from 'esbuild'
import fs from 'fs/promises'
import { ensureDir } from 'fs-extra'
import path from 'path'

/**
 * Copies the specified files after the build is done.
 */
const copyFilePlugin = (actions: { from: string; to: string }[]): Plugin => ({
  name: 'copyFilePlugin',
  setup(build) {
    build.onEnd(async () => {
      for (const action of actions) {
        if (process.env.WATCH === 'true') return

        await ensureDir(path.dirname(action.to))
        await fs.copyFile(action.from, action.to)
      }
    })
  },
})

export { copyFilePlugin }
