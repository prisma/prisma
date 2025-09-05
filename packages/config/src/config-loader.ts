import { existsSync } from 'fs'
import { basename, dirname, resolve } from 'path'
import { loadConfig } from 'c12'

import type { ConfigLoadOptions, ConfigLoadResult, RefractConfig } from './types.js'
import { RefractConfigSchema } from './types.js'

/**
 * Supported configuration file extensions
 */
const SUPPORTED_EXTENSIONS = ['.js', '.ts', '.mjs', '.cjs', '.mts', '.cts']

/**
 * Load Refract configuration with priority resolution using c12:
 * 1. Explicit config parameter (highest)
 * 2. Explicit configFile parameter
 * 3. refract.config.* files (auto-detected by c12)
 * 4. .config/refract.* files (auto-detected by c12)
 */
export async function loadRefractConfig(options: ConfigLoadOptions = {}): Promise<ConfigLoadResult> {
  const cwd = options.cwd || process.cwd()

  // Priority 1: Explicit config provided (highest)
  if (options.config) {
    const validatedConfig = RefractConfigSchema.parse(options.config)
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

    const validatedConfig = RefractConfigSchema.parse(loadedConfig)
    return {
      config: validatedConfig,
      configPath,
      configDir: dirname(configPath),
    }
  }

  // Priority 3: Auto-detect config files using c12
  const { config: loadedConfig, configFile } = await loadConfig({
    cwd,
    name: 'refract',
    jitiOptions: {
      interopDefault: true,
      moduleCache: false,
      extensions: SUPPORTED_EXTENSIONS,
    },
  })

  if (!loadedConfig) {
    throw new Error(
      'No Refract configuration found. Please create refract.config.ts or run `refract init`.\n' +
        'Searched for files like:\n' +
        '  - refract.config.ts\n' +
        '  - refract.config.js\n' +
        '  - refract.config.mjs\n' +
        '  - .config/refract.ts\n' +
        '  - .config/refract.js',
    )
  }

  const validatedConfig = RefractConfigSchema.parse(loadedConfig)
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
export function findSchemaFile(config: RefractConfig, configDir: string): string {
  const schemaPath = resolve(configDir, config.schema)

  if (!existsSync(schemaPath)) {
    throw new Error(`Schema file not found: ${schemaPath}. Check your configuration.`)
  }

  return schemaPath
}

/**
 * Get default output directory based on config file location
 * Makes .refract a sibling to the config file or .config directory
 */
export function getDefaultOutputDir(configPath: string | null): string {
  if (!configPath) {
    // No config file found, use basic default
    return './.refract'
  }

  const configFileName = basename(configPath)

  // If config is in .config/ directory, put .refract as sibling to .config/
  if (configPath.includes('/.config/')) {
    // Config is at project/.config/refract.ts
    // Output should be at project/.refract (sibling to .config/)
    return '../.refract'
  }

  // If config is refract.config.ts at root level, put .refract as sibling
  if (configFileName.startsWith('refract.config.')) {
    // Config is at project/refract.config.ts
    // Output should be at project/.refract (sibling to refract.config.ts)
    return './.refract'
  }

  // Fallback to basic default
  return './.refract'
}
