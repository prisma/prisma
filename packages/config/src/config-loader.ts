import { loadConfig } from 'c12'
import { existsSync } from 'fs'
import { basename, dirname, resolve } from 'path'

import type { ConfigLoadOptions, ConfigLoadResult, OrkConfig } from './types.js'
import { OrkConfigSchema } from './types.js'

/**
 * Supported configuration file extensions
 */
const SUPPORTED_EXTENSIONS = ['.js', '.ts', '.mjs', '.cjs', '.mts', '.cts']

/**
 * Load Ork configuration with priority resolution using c12:
 * 1. Explicit config parameter (highest)
 * 2. Explicit configFile parameter
 * 3. ork.config.* files (auto-detected by c12)
 * 4. .config/ork.* files (auto-detected by c12)
 */
export async function loadOrkConfig(options: ConfigLoadOptions = {}): Promise<ConfigLoadResult> {
  const cwd = options.cwd || process.cwd()

  // Priority 1: Explicit config provided (highest)
  if (options.config) {
    const validatedConfig = OrkConfigSchema.parse(options.config)
    return {
      config: validatedConfig,
      configPath: null,
      configDir: cwd,
    }
  }

  // Priority 2: Explicit config file
  if (options.configFile) {
    const configPath = resolve(cwd, options.configFile)
    if (!existsSync(configPath)) {
      throw new Error(`Config file not found: ${configPath}`)
    }

    const { config: loadedConfig } = await loadConfig({
      cwd: dirname(configPath),
      configFile: basename(configPath),
      jitiOptions: {
        interopDefault: true,
        moduleCache: false,
        extensions: SUPPORTED_EXTENSIONS,
      },
    })

    if (!loadedConfig) {
      throw new Error(`Failed to load configuration from ${configPath}`)
    }

    const validatedConfig = OrkConfigSchema.parse(loadedConfig)
    return {
      config: validatedConfig,
      configPath,
      configDir: dirname(configPath),
    }
  }

  // Priority 3: Auto-detect config files using c12
  const { config: loadedConfig, configFile } = await loadConfig({
    cwd,
    name: 'ork',
    jitiOptions: {
      interopDefault: true,
      moduleCache: false,
      extensions: SUPPORTED_EXTENSIONS,
    },
  })

  if (!loadedConfig) {
    throw new Error(
      'No Ork configuration found. Please create ork.config.ts or run `ork init`.\n' +
        'Searched for files like:\n' +
        '  - ork.config.ts\n' +
        '  - ork.config.js\n' +
        '  - ork.config.mjs\n' +
        '  - .config/ork.ts\n' +
        '  - .config/ork.js',
    )
  }

  const validatedConfig = OrkConfigSchema.parse(loadedConfig)
  const configPath = configFile || null
  const configDir = configPath ? dirname(configPath) : cwd

  return {
    config: validatedConfig,
    configPath,
    configDir,
  }
}

/**
 * Find schema file based on configuration
 */
export function findSchemaFile(config: OrkConfig, configDir: string): string {
  const schemaPath = resolve(configDir, config.schema)

  if (!existsSync(schemaPath)) {
    throw new Error(`Schema file not found: ${schemaPath}. Check your configuration.`)
  }

  return schemaPath
}

/**
 * Get default output directory based on config file location
 * Makes .ork a sibling to the config file or .config directory
 */
export function getDefaultOutputDir(configPath: string | null): string {
  if (!configPath) {
    // No config file found, use basic default
    return './.ork'
  }

  const configFileName = basename(configPath)

  // If config is in .config/ directory, put .ork as sibling to .config/
  if (configPath.includes('/.config/')) {
    // Config is at project/.config/ork.ts
    // Output should be at project/.ork (sibling to .config/)
    return '../.ork'
  }

  // If config is ork.config.ts at root level, put .ork as sibling
  if (configFileName.startsWith('ork.config.')) {
    // Config is at project/ork.config.ts
    // Output should be at project/.ork (sibling to ork.config.ts)
    return './.ork'
  }

  // Fallback to basic default
  return './.ork'
}
