/**
 * @refract/cli - Modern CLI for Refract ORM
 *
 * This package provides the command-line interface for Refract,
 * a TypeScript-native ORM with declarative schema syntax.
 */

export type { CommandContext, CommandResult, RefractConfig } from './types.js'
export { RefractConfigSchema } from './types.js'
export { BaseCommand, createProgram } from './utils/command.js'
export { logger, RefractLogger } from './utils/logger.js'
export {
  createKyselyFromConfig,
  findSchemaFile,
  loadRefractConfig as loadConfig,
  validateConnection,
} from '@refract/config'

// Command exports
export { generateClient, GenerateCommand } from './commands/generate.js'
export { InitCommand } from './commands/init.js'

/**
 * Helper function for defining configuration (used in refract.config.ts or .config/refract.ts)
 */
export function defineConfig(config: any) {
  return config
}
