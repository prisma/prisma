/**
 * Builds the necessary bits so that our users can get a helpful warning during
 * "generate" in case of conflicts between their environment & their env files.
 * @param edge
 * @param runtimeDir
 * @param runtimeName
 * @returns
 */
export function buildWarnEnvConflicts(edge: boolean | undefined, runtimeDir: string, runtimeName: string) {
  if (edge === true) return ''

  return `
const { warnEnvConflicts } = require('${runtimeDir}/${runtimeName}')

warnEnvConflicts({
    rootEnvPath: config.relativeEnvPaths.rootEnvPath && path.resolve(dirname, config.relativeEnvPaths.rootEnvPath),
    schemaEnvPath: config.relativeEnvPaths.schemaEnvPath && path.resolve(dirname, config.relativeEnvPaths.schemaEnvPath)
})`
}
