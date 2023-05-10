/**
 * Builds a require statement for `path`.
 * @param edge
 * @returns
 */
export function buildNodeImports(edge: boolean, esm: boolean | undefined) {
  if (edge === true) return ''

  if (esm === true) {
    return `import path from 'path'
import fs from 'fs'`
  } else {
    return `const path = require('path')
const fs = require('fs')`
  }
}
