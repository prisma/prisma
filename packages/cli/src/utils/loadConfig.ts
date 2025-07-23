import { Debug } from '@prisma/debug'
import { assertNever, HelpError } from '@prisma/internals'
import { loadConfigFromFile, type PrismaConfigInternal } from '@vetching-corporation/prisma-config'

const debug = Debug('prisma:cli:loadConfig')

/**
 * Will try to load the prisma config file from the given path, default path or create a default config.
 */
export async function loadConfig(configFilePath?: string): Promise<PrismaConfigInternal | HelpError> {
  const { config, error, resolvedPath } = await loadConfigFromFile({ configFile: configFilePath })

  if (error) {
    debug('Error loading config file: %o', error)
    switch (error._tag) {
      case 'ConfigFileNotFound':
        return new HelpError(`Config file not found at "${resolvedPath}"`)
      case 'ConfigFileParseError':
        return new HelpError(`Failed to parse config file at "${resolvedPath}"`)
      case 'TypeScriptImportFailed':
        return new HelpError(`Failed to import config file as TypeScript from "${resolvedPath}". Error: ${error.error}`)
      case 'UnknownError':
        return new HelpError(`Unknown error during config file loading: ${error.error}`)
      default:
        assertNever(error, `Unhandled error '${JSON.stringify(error)}' in 'loadConfigFromFile'.`)
    }
  }

  return config
}
