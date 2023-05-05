import type { Plugin } from 'esbuild'

/**
 * Plugin that forces "sideEffects": false on third party packages
 * that do not have it specified.
 * Needed for esbuild to be able to tree-shake those packages if
 * they are not used.
 *
 * @param pattern plugin applies only to the modules matching the pattern
 * @returns
 */
export function noSideEffectsPlugin(pattern: RegExp): Plugin {
  return {
    name: 'noSideEffectsPlugin',
    setup(build) {
      build.onResolve({ filter: pattern }, async (args) => {
        if (args.pluginData?.resolved === true) {
          return undefined
        }
        args.pluginData = { resolved: true }
        const { path, ...rest } = args

        const result = await build.resolve(path, rest)
        result.sideEffects = false
        return result
      })
    },
  }
}
