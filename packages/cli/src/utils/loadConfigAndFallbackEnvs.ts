import { defaultConfig, loadConfigFromFile, PrismaConfig } from '@prisma/config'
import { loadEnvFile } from '@prisma/internals'

export async function loadConfigAndFallbackEnvs(args: {
  configFileArg?: string
  schemaPathArg?: string
}): Promise<{ config: PrismaConfig; configPath: string | null }> {
  const { config, error, resolvedPath } = await loadConfigFromFile({ configFile: args.configFileArg })

  if (error) {
    console.log(`Loaded config file from: ${resolvedPath}`)
    console.log(`🛑 Error loading Prisma config: ${error._tag}`)
    process.exit(1)
  }

  if (config) {
    console.debug(`Prisma config detected, skipping environment variable loading`)
  } else {
    await loadEnvFile({ schemaPath: args.schemaPathArg, printMessage: true })
  }

  return { config: { ...defaultConfig(), ...config }, configPath: resolvedPath }
}
