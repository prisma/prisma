import path from 'node:path'
import process from 'node:process'

import { Debug } from '@prisma/driver-adapter-utils'
import { loadConfig as loadConfigWithC12 } from 'c12'
import { deepmerge } from 'deepmerge-ts'

import { defaultConfig } from './defaultConfig'
import type { PrismaConfigInternal } from './defineConfig'
import { parseDefaultExport } from './PrismaConfig'

const debug = Debug('prisma:config:loadConfigFromFile')

// Note: as of c12@3.1.0, config extensions are tried in the following order, regardless of how we pass them
// to `jiti` or to `jitiOptions.extensions`.
// See: https://github.com/unjs/c12/blob/1efbcbce0e094a8f8a0ba676324affbef4a0ba8b/src/loader.ts#L35-L42
export const SUPPORTED_EXTENSIONS = [
  ".js",
  ".ts",
  ".mjs",
  ".cjs",
  ".mts",
  ".cts",
] as const satisfies string[]

type LoadConfigFromFileInput = {
  /**
   * The path to the config file to load. If not provided, we will attempt to find a config file in the `configRoot` directory.
   */
  configFile?: string

  /**
   * The directory to search for the config file in. Defaults to the current working directory.
   */
  configRoot?: string
}

export type LoadConfigFromFileError =
  | {
      _tag: 'ConfigFileNotFound'
    }
  | {
      _tag: 'TypeScriptImportFailed'
      error: Error
    }
  | {
      _tag: 'ConfigFileParseError'
      error: Error
    }
  | {
      _tag: 'UnknownError'
      error: Error
    }

export type ConfigFromFile =
  | {
      resolvedPath: string
      config: PrismaConfigInternal
      error?: never
    }
  | {
      resolvedPath: string
      config?: never
      error: LoadConfigFromFileError
    }
  | {
      resolvedPath: null
      config: PrismaConfigInternal
      error?: never
    }

/**
 * Load a Prisma config file from the given directory.
 * This function may fail, but it will never throw.
 * The possible error is returned in the result object, so the caller can handle it as needed.
 */

export async function loadConfigFromFile({
  configFile,
  configRoot = process.cwd(),
}: LoadConfigFromFileInput): Promise<ConfigFromFile> {
  const start = performance.now()
  const getTime = () => `${(performance.now() - start).toFixed(2)}ms`

  try {
    const { configModule, resolvedPath, error } = await loadConfigTsOrJs(configRoot, configFile)

    if (error) {
      return {
        resolvedPath,
        error,
      }
    }

    debug(`Config file loaded in %s`, getTime())
  
    if (resolvedPath === null) {
      debug(`No config file found in the current working directory %s`, configRoot)
  
      return { resolvedPath: null, config: defaultConfig() }
    }

    let parsedConfig: PrismaConfigInternal | undefined

    try {
      parsedConfig = parseDefaultExport(configModule)
    } catch (e) {
      const error = e as Error
      return {
        resolvedPath,
        error: {
          _tag: 'ConfigFileParseError',
          error,
        },
      }
    }
  
    // TODO: this line causes https://github.com/prisma/prisma/issues/27609.
    process.stdout.write(`Loaded Prisma config from "${resolvedPath}".\n`)
    const prismaConfig = transformPathsInConfigToAbsolute(parsedConfig, resolvedPath)
  
    return {
      config: {
        ...prismaConfig,
        loadedFromFile: resolvedPath,
      },
      resolvedPath,
    }
  } catch (e) {
    // As far as we know, this branch should be unreachable.
    const error = e as Error

    return {
      resolvedPath: configRoot,
      error: {
        _tag: 'UnknownError',
        error,
      },
    }
  }
}

async function loadConfigTsOrJs(configRoot: string, configFile: string | undefined) {
  try {
    const { config, configFile: resolvedPath, meta } = await loadConfigWithC12({
      cwd: configRoot,
      // configuration base name
      name: 'prisma',
      // the config file to load (without file extensions), defaulting to `${cwd}.${name}`
      configFile,
      // do not load .env files
      dotenv: false,
      // do not load RC config
      rcFile: false,
      // do not extend remote config files
      giget: false,
      // do not extend the default config
      extend: false,
      // do not load from nearest package.json
      packageJson: false,
      // specify the default config to use
      // defaultConfig: defaultConfig(),
      
      // @ts-expect-error: this is a type-error in `c12` itself
      merger: deepmerge,

      jitiOptions: {
        interopDefault: true,
        moduleCache: true,
        extensions: SUPPORTED_EXTENSIONS,
      },
    })

    const doesConfigFileExist = resolvedPath !== undefined && meta !== undefined

    if (configFile && !doesConfigFileExist) {
      debug(`The given config file was not found at %s`, resolvedPath)
      return {
        require: null,
        resolvedPath: path.join(configRoot, configFile),
        error: { _tag: 'ConfigFileNotFound' } as const,
      } as const
    }

    if (doesConfigFileExist) {
      const extension = path.extname(path.basename(resolvedPath))

      if (!(SUPPORTED_EXTENSIONS as string[]).includes(extension)) {
        return {
          configModule: config,
          resolvedPath,
          error: {
            _tag: 'TypeScriptImportFailed',
            error: new Error(`Unsupported Prisma config file extension: ${extension}`),
          } as const,
        } as const
      }
    }

    return {
      configModule: config,
      resolvedPath: doesConfigFileExist ? resolvedPath : null,
      error: null,
    } as const
  } catch (e) {
    const error = e as Error
    debug('jiti import failed: %s', error.message)

    // Extract the location of config file that couldn't be read from jiti's wrapped BABEL_PARSE_ERROR message.
    const configFileMatch = error.message.match(/prisma\.config\.(\w+)/)
    const extension = configFileMatch?.[1]
    const filenameWithExtension = path.join(configRoot, extension ? `prisma.config.${extension}` : '')
    debug('faulty config file: %s', filenameWithExtension)

    return {
      error: {
        _tag: 'TypeScriptImportFailed',
        error,
      } as const,
      resolvedPath: filenameWithExtension,
    } as const
  }
}

function transformPathsInConfigToAbsolute(
  prismaConfig: PrismaConfigInternal,
  resolvedPath: string,
): PrismaConfigInternal {
  function resolvePath(value: string | undefined) {
    if (!value) {
      return undefined
    }

    return path.resolve(path.dirname(resolvedPath), value)
  }

  return {
    ...prismaConfig,
    schema: resolvePath(prismaConfig.schema),
    migrations: {
      ...prismaConfig.migrations,
      path: resolvePath(prismaConfig.migrations?.path),
    },
    typedSql: {
      ...prismaConfig.typedSql,
      path: resolvePath(prismaConfig.typedSql?.path),
    },
    views: {
      ...prismaConfig.views,
      path: resolvePath(prismaConfig.views?.path),
    },
  }
}
