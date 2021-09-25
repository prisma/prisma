import type * as esbuild from 'esbuild'

function unusedPlugin(dev = false): esbuild.Plugin {
  return {
    name: 'unusedPlugin',
    setup(build) {
      const onlyPackages = /^[^.\/]|^\.[^.\/]|^\.\.[^\/]/
      build.onResolve({ filter: onlyPackages }, (args) => ({
        path: args.path,
        external: true,
      }))
    },
  }
}

export { unusedPlugin }
