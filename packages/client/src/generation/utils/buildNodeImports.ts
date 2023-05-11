import { TSClientOptions } from '../TSClient/TSClient'

/**
 * Builds a require statement for `path`.
 * @param options
 * @returns
 */
export function buildNodeImports({ edge, esm }: TSClientOptions) {
  if (edge === true) return ''

  if (esm === true) {
    return `import path from 'path'
import fs from 'fs'`
  } else {
    return `const path = require('path')
const fs = require('fs')`
  }
}
