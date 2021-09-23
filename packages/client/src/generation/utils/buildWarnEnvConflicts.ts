import { ClientEngineType } from '../../runtime/utils/getClientEngineType'

export function buildWarnEnvConflicts(
  clientEngineType: ClientEngineType,
  runtimePath: string,
) {
  if (clientEngineType !== ClientEngineType.DataProxy) {
    return `
const { warnEnvConflicts } = require('${runtimePath}')

warnEnvConflicts({
    rootEnvPath: config.relativeEnvPaths.rootEnvPath && path.resolve(dirname, config.relativeEnvPaths.rootEnvPath),
    schemaEnvPath: config.relativeEnvPaths.schemaEnvPath && path.resolve(dirname, config.relativeEnvPaths.schemaEnvPath)
})`
  }

  return ''
}
