/**
 * Builds a require statement for `path`.
 * @param dataProxy
 * @returns
 */
export function buildRequirePath(dataProxy: boolean) {
  if (dataProxy === false) {
    return `
const path = require('path')`
  }

  return ''
}
