import type * as esbuild from 'esbuild'

export const fixImportsPlugin: esbuild.Plugin = {
  name: 'fixImportsPlugin',
  setup(build) {
    build.onResolve({ filter: /^spdx-exceptions/ }, () => {
      return { path: require.resolve('spdx-exceptions') }
    })
    build.onResolve({ filter: /^spdx-license-ids/ }, () => {
      return { path: require.resolve('spdx-license-ids') }
    })
  },
}
