import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'

import { Debug } from '@prisma/driver-adapter-utils'
import { createJiti } from 'jiti'

import { defaultConfig } from './defaultConfig'
import type { PrismaConfigInternal } from './defineConfig'
import { parseDefaultExport } from './PrismaConfig'

const debug = Debug('prisma:config:loadConfigFromFile')

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
      config: PrismaConfigInternal<any>
      error?: never
    }
  | {
      resolvedPath: string
      config?: never
      error: LoadConfigFromFileError
    }
  | {
      resolvedPath: null
      config: PrismaConfigInternal<any>
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

  let resolvedPath: string | null

  if (configFile) {
    // The user gave us a specific config file to load. If it doesn't exist, we should raise an error.
    resolvedPath = path.resolve(configRoot, configFile)

    if (!fs.existsSync(resolvedPath)) {
      debug(`The given config file was not found at %s`, resolvedPath)
      return { resolvedPath, error: { _tag: 'ConfigFileNotFound' } }
    }
  } else {
    // We attempt to find a config file in the given directory. If none is found, we should return early, without errors.
    resolvedPath =
      ['prisma.config.ts'].map((file) => path.resolve(configRoot, file)).find((file) => fs.existsSync(file)) ?? null

    if (resolvedPath === null) {
      debug(`No config file found in the current working directory %s`, configRoot)

      return { resolvedPath, config: defaultConfig() }
    }
  }

  try {
    const { required, error } = await requireTypeScriptFile(resolvedPath)

    if (error) {
      return {
        resolvedPath,
        error,
      }
    }

    debug(`Config file loaded in %s`, getTime())

    let defaultExport: PrismaConfigInternal<any> | undefined

    try {
      // @ts-expect-error
      defaultExport = parseDefaultExport(required['default'])
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

    process.stdout.write(`Loaded Prisma config from "${resolvedPath}".\n`)
    const prismaConfig = transformPathsInConfigToAbsolute(defaultExport, resolvedPath)

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
      resolvedPath,
      error: {
        _tag: 'UnknownError',
        error,
      },
    }
  }
}

async function requireTypeScriptFile(resolvedPath: string) {
  try {
    const jiti = createJiti(__filename, {
      interopDefault: true,
      moduleCache: false,
    })
    const configExport = await jiti.import(resolvedPath)

    return {
      required: configExport,
      error: null,
    }
  } catch (e) {
    const error = e as Error
    debug('jiti import failed: %s', error.message)

    return {
      error: {
        _tag: 'TypeScriptImportFailed',
        error,
      } as const,
    }
  }
}

function transformPathsInConfigToAbsolute(
  prismaConfig: PrismaConfigInternal<any>,
  resolvedPath: string,
): PrismaConfigInternal<any> {
  const resolvePath = (value: string | undefined) =>
    value ? path.resolve(path.dirname(resolvedPath), value) : undefined

  return {
    ...prismaConfig,
    migrate: prismaConfig.migrate
      ? {
          ...prismaConfig.migrate,
          migrationsDirectory: resolvePath(prismaConfig.migrate.migrationsDirectory),
        }
      : undefined,
    schema: resolvePath(prismaConfig.schema),
    viewsDirectory: resolvePath(prismaConfig.viewsDirectory),
    typedSqlDirectory: resolvePath(prismaConfig.typedSqlDirectory),
  }
}
