import { z } from 'zod'

import { SUPPORTED_PROVIDERS } from './constants.js'

/**
 * Refract configuration schema
 */
export const RefractConfigSchema = z.object({
  datasource: z.object({
    provider: z.enum(SUPPORTED_PROVIDERS),
    url: z.string(),
    shadowDatabaseUrl: z.string().optional(),
  }),
  generator: z
    .object({
      provider: z.string().default('@refract/client'),
      output: z.string().default('./node_modules/@refract/client'),
    })
    .optional(),
  schema: z.string().default('./schema.prisma'),
})

export type RefractConfig = z.infer<typeof RefractConfigSchema>

/**
 * Configuration loading options with priority resolution
 */
export interface ConfigLoadOptions {
  /**
   * Priority 1: Explicit config to use instead of loading from file
   * Highest priority - bypasses all file loading
   */
  config?: RefractConfig

  /**
   * Starting directory to search for config files
   * Defaults to process.cwd()
   */
  cwd?: string

  /**
   * Priority 2: Explicit config file path
   * Higher priority than auto-discovery
   */
  configFile?: string
}

/**
 * Result of configuration loading
 */
export interface ConfigLoadResult {
  config: RefractConfig
  configPath: string | null
  configDir: string
}

/**
 * Kysely creation result
 */
export interface KyselyResult {
  kysely: import('kysely').Kysely<any>
  config: RefractConfig
  configPath: string | null
  configDir: string
}
