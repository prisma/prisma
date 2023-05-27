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
import url from 'url'
import fs from 'fs'`
  } else {
    return `const path = require('path')
const url = require('url')
const fs = require('fs')`
  }
}
