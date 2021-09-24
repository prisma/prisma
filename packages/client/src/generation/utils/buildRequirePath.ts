import { ClientEngineType } from '../../runtime/utils/getClientEngineType'

/**
 * Builds a require statement for `path`.
 * @param clientEngineType
 * @returns
 */
export function buildRequirePath(clientEngineType: ClientEngineType) {
  if (clientEngineType !== ClientEngineType.DataProxy) {
    return `
const path = require('path')`
  }

  return ''
}
