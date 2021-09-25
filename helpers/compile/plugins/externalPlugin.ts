import type { Plugin } from 'esbuild'

/**
 * esbuild plugin that marks all packages as external
 */
const externalPlugin: Plugin = {
  name: 'externalPlugin',
  setup(build) {
    const onlyPackages = /^[^.\/]|^\.[^.\/]|^\.\.[^\/]/
    build.onResolve({ filter: onlyPackages }, (args) => ({
      path: args.path,
      external: true,
    }))
  },
}

export { externalPlugin }
