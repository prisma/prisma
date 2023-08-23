const fs = require('fs')

const esbuild = require('esbuild')
const getCacheKeyFunction = require('@jest/create-cache-key-function').default

const nodeVersion = process.version.match(/v(\d+)/)[1] || '14'
const cacheKeyFunction = getCacheKeyFunction([], ['v1', nodeVersion])

function needsTranspilation(contents, filename) {
  if (filename.endsWith('.ts') === true) {
    return true
  }

  if (filename.endsWith('.mjs') === true) {
    return true
  }

  if (contents.includes('require(') === true) {
    return false
  }

  if (contents.includes('module.exports') === true) {
    return false
  }

  if (contents.includes('exports.') === true) {
    return false
  }

  return true
}

const transformer = {
  getCacheKey(contents, filename, ...rest) {
    return cacheKeyFunction(filename, fs.statSync(filename).mtimeMs.toString(), ...rest)
  },
  process(_content, filename, { transformerConfig }) {
    if (needsTranspilation(_content, filename) === true) {
      return esbuild.transformSync(_content, {
        sourcesContent: true,
        minify: false,
        sourcefile: filename,
        loader: 'ts',
        format: 'cjs',
        platform: 'node',
        target: `node${nodeVersion}`,
        keepNames: true,
        logLevel: 'error',
        sourcemap: true,
        ...transformerConfig,
      })
    }

    try {
      return {
        code: _content,
        map: fs.readFileSync(`${filename}.map`, 'utf8'),
      }
    } catch (e) {}

    return {
      code: _content,
    }
  },
}

module.exports = transformer
