/**
 * This package provides the command-line interface for Ork,
 * a TypeScript-native ORM with declarative schema syntax.
 */

export type { CommandContext, CommandResult, OrkConfig } from './types.js'
export { OrkConfigSchema } from './types.js'
export { BaseCommand, createProgram } from './utils/command.js'
export { logger, OrkLogger } from './utils/logger.js'
export {
  createKyselyFromConfig,
  findSchemaFile,
  loadOrkConfig as loadConfig,
  validateConnection,
} from '@ork-orm/config'

// Command exports
export { generateClient, GenerateCommand } from './commands/generate.js'
export { InitCommand } from './commands/init.js'

/**
 * Helper function for defining configuration (used in ork.config.ts or .config/ork.ts)
 */
export function defineConfig(config: any) {
  return config
}
