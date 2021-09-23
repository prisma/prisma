import { ClientEngineType } from '../../runtime/utils/getClientEngineType'

export function buildRequirePath(clientEngineType: ClientEngineType) {
  if (clientEngineType !== ClientEngineType.DataProxy) {
    return `
const path = require('path')`
  }

  return ''
}
