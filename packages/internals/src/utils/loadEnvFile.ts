import { getEnvPaths } from './getEnvPaths'
import { type ParsedEnv, tryLoadEnvs } from './tryLoadEnvs'

/**
 * Read .env file only if next to schema.prisma
 * .env found: print to console it's relative path
 */
export async function loadEnvFile({
  schemaPath,
  printMessage = false,
}: { schemaPath?: string; printMessage?: boolean } = {}): Promise<ParsedEnv> {
  const envPaths = await getEnvPaths(schemaPath)
  const envData = tryLoadEnvs(envPaths, { conflictCheck: 'error' })

  if (printMessage && envData && envData.message) {
    process.stdout.write(envData.message + '\n')
  }

  if (envData === undefined) {
    return globalThis['PRISMA_PROCESS_ENV']
  }

  return envData.parsed
}
