'use strict'

const esbuild = require('esbuild')

module.exports = {
  getCacheKey(fileData, filePath, configStr, options) {
    return filePath
  },
  processAsync(src, filename) {
    return esbuild.transform(src, {
      loader: 'ts',
      format: 'cjs',
      target: 'es2020',
      tsconfigRaw: {},
      sourcefile: filename,
      keepNames: true,
      sourcemap: true,
    })
  },
  process(src, filename) {
    return esbuild.transformSync(src, {
      loader: 'ts',
      format: 'cjs',
      target: 'es2020',
      tsconfigRaw: {},
      sourcefile: filename,
      keepNames: true,
      sourcemap: true,
    })
  },
}
