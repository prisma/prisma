import type { TSClientOptions } from '../TSClient/TSClient'

/**
 * Builds the necessary bits so that our users can get a helpful warning during
 * "generate" in case of conflicts between their environment & their env files.
 * @param edge
 * @param runtimeBase
 * @param runtimeNameJs
 * @returns
 */
export function buildWarnEnvConflicts(
  edge: boolean,
  runtimeBase: string,
  runtimeNameJs: TSClientOptions['runtimeNameJs'],
) {
  if (edge === true) return ''

  return `
const { warnEnvConflicts } = require('${runtimeBase}/${runtimeNameJs}.js')

warnEnvConflicts({
    rootEnvPath: config.relativeEnvPaths.rootEnvPath && path.resolve(config.dirname, config.relativeEnvPaths.rootEnvPath),
    schemaEnvPath: config.relativeEnvPaths.schemaEnvPath && path.resolve(config.dirname, config.relativeEnvPaths.schemaEnvPath)
})`
}
