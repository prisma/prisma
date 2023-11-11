import type * as esbuild from 'esbuild'
import fs from 'fs/promises'

/**
 * Emit a metafile for each build.
 */
export const metaFilePlugin: esbuild.Plugin = {
  name: 'onErrorPlugin',
  setup(build) {
    build.onEnd(async (result) => {
      if (result.metafile) {
        // use https://bundle-buddy.com/esbuild to analyses
        await fs.writeFile(`${build.initialOptions.outfile}.metafile.json`, JSON.stringify(result.metafile))
      }
    })
  },
}
