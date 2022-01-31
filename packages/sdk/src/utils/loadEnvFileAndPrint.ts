import { tryLoadEnvs } from './tryLoadEnvs'
import { getEnvPaths } from './getEnvPaths'

/**
 * Read .env file only if next to schema.prisma
 * .env found: print to console it's relative path
 */
export function loadEnvFileAndPrint(schemaPath?: string) {
  const envPaths = getEnvPaths(schemaPath)
  const envData = tryLoadEnvs(envPaths, { conflictCheck: 'error' })
  envData && envData.message && console.info(envData.message)
}
