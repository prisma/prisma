import type { PrismaConfigInternal } from '@prisma/config'

import { getEnvPaths } from './getEnvPaths'
import { tryLoadEnvs } from './tryLoadEnvs'

/**
 * Read .env file only if next to schema.prisma
 * .env found: print to console its relative path
 */
export async function loadEnvFile({
  schemaPath,
  config,
  printMessage = false,
}: {
  schemaPath?: string
  printMessage?: boolean
  config: PrismaConfigInternal
}) {
  if (config.loadedFromFile) {
    process.stdout.write('Prisma config detected, skipping environment variable loading.\n')
    return
  }

  const envPaths = await getEnvPaths(schemaPath)
  const envData = tryLoadEnvs(envPaths, { conflictCheck: 'error' })

  if (printMessage && envData && envData.message) {
    process.stdout.write(`${envData.message}\n`)
  }
}
