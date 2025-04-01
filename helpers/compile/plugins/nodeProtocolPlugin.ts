import { builtinModules } from 'node:module'

import type * as esbuild from 'esbuild'

const unprefixedCoreModules = builtinModules.filter((name) => !name.startsWith('node:'))
const coreModulePattern = new RegExp(`^(${unprefixedCoreModules.join('|')})$`)

/**
 * Replaces all unprefixed Node.js core modules imports with the equivalent
 * imports with `node:` protocol for compatibility with other JavaScript runtimes.
 */
export const nodeProtocolPlugin: esbuild.Plugin = {
  name: 'nodeProtocolPlugin',
  setup(build) {
    build.onResolve({ filter: coreModulePattern }, (args) => {
      return { path: `node:${args.path}`, external: true }
    })
  },
}
