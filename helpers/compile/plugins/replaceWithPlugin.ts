import { builtinModules } from 'module'
import type * as esbuild from 'esbuild'
import fs from 'fs'

type Replacement = [RegExp, string | ((regex: RegExp, contents: string) => string | Promise<string>)]

async function applyReplacements(contents: string, replacements: Replacement[]) {
  for (const [regex, replacement] of replacements) {
    if (typeof replacement === 'string') {
      contents = contents.replace(regex, replacement)
    } else {
      contents = await replacement(regex, contents)
    }
  }

  return contents
}

/**
 * Replace the contents of a file with the given replacements.
 * @param replacements
 * @returns
 */
export const replaceWithPlugin = (replacements: Replacement[]): esbuild.Plugin => {
  return {
    name: 'replaceWithPlugin',
    setup(build) {
      build.onLoad({ filter: /.*/ }, async (args) => {
        // we skip, don't attempt to edit files that aren't js
        if (builtinModules.includes(args.path)) return {}
        if (!/.*?(.js|.mjs)$/.exec(args.path)) return {}

        const contents = await fs.promises.readFile(args.path, 'utf8')

        return { contents: await applyReplacements(contents, replacements) }
      })
    },
  }
}
