import { tryLoadEnvs } from './tryLoadEnvs'
import { getEnvPaths } from './getEnvPaths'

/**
 * Read .env file only if next to schema.prisma
 * .env found: print to console it's relative path
 */
export function loadEnvFile(schemaPath?: string, print = false) {
  const envPaths = getEnvPaths(schemaPath)
  const envData = tryLoadEnvs(envPaths, { conflictCheck: 'error' })

  if (print && envData && envData.message) {
    console.info(envData.message)
  }
}
