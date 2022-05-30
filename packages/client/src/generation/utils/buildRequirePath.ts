/**
 * Builds a require statement for `path`.
 * @param dataProxy
 * @returns
 */
export function buildRequirePath(dataProxy: boolean | undefined) {
  if (dataProxy === true) return ''

  return `
  const path = require('path')`
}
