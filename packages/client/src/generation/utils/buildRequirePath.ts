/**
 * Builds a require statement for `path`.
 * @param edge
 * @returns
 */
export function buildRequirePath(edge: boolean) {
  if (edge === true) return ''

  return `
  const path = require('path')`
}
