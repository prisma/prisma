import { getEnvPaths } from './getEnvPaths'
import { tryLoadEnvs } from './tryLoadEnvs'

/**
 * Read .env file only if next to schema.prisma
 * .env found: print to console it's relative path
 */
export function loadEnvFile({
  schemaPath,
  printMessage = false,
}: { schemaPath?: string; printMessage?: boolean } = {}) {
  const envPaths = getEnvPaths(schemaPath)
  const envData = tryLoadEnvs(envPaths, { conflictCheck: 'error' })

  if (printMessage && envData && envData.message) {
    process.stdout.write(envData.message + '\n')
  }
}
