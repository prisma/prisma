'use strict'

const esbuild = require('esbuild')
const createCacheKeyFunction = require('@jest/create-cache-key-function').default

module.exports = {
  getCacheKeyAsync: createCacheKeyFunction([], []),
  processAsync(src, filename) {
    return esbuild.transform(src, {
      loader: 'ts',
      format: 'cjs',
      target: 'es2020',
      tsconfigRaw: {},
      sourcefile: filename,
      sourcemap: true,
    })
  },
  getCacheKey: createCacheKeyFunction([], []),
  process(src, filename) {
    return esbuild.transformSync(src, {
      loader: 'ts',
      format: 'cjs',
      target: 'es2020',
      tsconfigRaw: {},
      sourcefile: filename,
      sourcemap: true,
    })
  },
}
