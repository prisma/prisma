// Re-export shared types from @refract/config
// Import for use in local interfaces
import type { RefractConfig } from '@refract/config'

export type { RefractConfig } from '@refract/config'
export { RefractConfigSchema } from '@refract/config'

/**
 * CLI command context
 */
export interface CommandContext {
  config: RefractConfig
  schemaPath: string
  configPath: string
  cwd: string
}

/**
 * Command result types
 */
export interface CommandResult {
  success: boolean
  message?: string
  error?: Error
}

/**
 * Initialization options
 */
export interface InitOptions {
  url?: string
  force?: boolean
  template?: 'basic' | 'ecommerce' | 'blog'
  skipEnv?: boolean
  skipSchema?: boolean
}

/**
 * Migration options
 */
export interface MigrateOptions {
  yes?: boolean
  dryRun?: boolean
}

/**
 * Generate options
 */
export interface GenerateOptions {
  output?: string
  watch?: boolean
}

/**
 * Logger interface for consistent output
 */
export interface Logger {
  info(message: string): void
  success(message: string): void
  warn(message: string): void
  error(message: string): void
  debug(message: string): void
}
