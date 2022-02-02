import { tryLoadEnvs } from './tryLoadEnvs'
import { getEnvPaths } from './getEnvPaths'
import Debug from '@prisma/debug'

const debug = Debug('prisma:loadEnvFile')

/**
 * Read .env file only if next to schema.prisma
 * .env found: print to console it's relative path
 */
export function loadEnvFile(schemaPath?: string, print = false) {
  const envPaths = getEnvPaths(schemaPath)
  debug({ envPaths })
  const envData = tryLoadEnvs(envPaths, { conflictCheck: 'error' })
  debug({ envData })

  if (print && envData && envData.message) {
    console.info(envData.message)
  }
}
