import type * as esbuild from 'esbuild'
import fs from 'fs'

function applyReplacements(contents: string, replacements: [RegExp, string][]) {
  for (const [regex, replacement] of replacements) {
    contents = contents.replace(regex, replacement)
  }

  return contents
}

/**
 * Replace the contents of a file with the given replacements.
 * @param replacements
 * @returns
 */
export const replaceWithPlugin = (replacements: [RegExp, string][]): esbuild.Plugin => {
  return {
    name: 'replaceWithPlugin',
    setup(build) {
      build.onLoad({ filter: /.*/ }, async (args) => {
        const contents = await fs.promises.readFile(args.path, 'utf8')

        return { contents: applyReplacements(contents, replacements) }
      })
    },
  }
}
