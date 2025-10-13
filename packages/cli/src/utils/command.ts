import { findSchemaFile } from '@refract/config'
import { Command } from 'commander'

import type { CommandContext, CommandResult } from '../types.js'
import { cliLoadRefractConfig } from './config-error-handler.js'
import { logger } from './logger.js'

/**
 * Base command class with common functionality
 */
export abstract class BaseCommand {
  protected context?: CommandContext

  /**
   * Initialize command context by loading configuration
   */
  protected async initContext(cwd: string = process.cwd()): Promise<CommandContext> {
    if (this.context) {
      return this.context
    }

    try {
      const { config, configPath, configDir } = await cliLoadRefractConfig({ cwd })
      const schemaPath = findSchemaFile(config, configDir)

      this.context = {
        config,
        schemaPath,
        configPath: configPath || '',
        cwd: configDir,
      }

      return this.context
    } catch (error) {
      logger.error(`Failed to initialize command context: ${error instanceof Error ? error.message : String(error)}`)
      process.exit(1)
    }
  }

  /**
   * Execute the command with proper error handling
   */
  abstract execute(...args: any[]): Promise<CommandResult>

  /**
   * Handle command execution with consistent error handling
   */
  async run(...args: any[]): Promise<void> {
    try {
      const result = await this.execute(...args)

      if (!result.success) {
        if (result.error) {
          logger.error(result.error.message)
        } else if (result.message) {
          logger.error(result.message)
        }
        process.exit(1)
      } else if (result.message) {
        logger.success(result.message)
      }
    } catch (error) {
      logger.error(`Command failed: ${error instanceof Error ? error.message : String(error)}`)

      if (process.env.DEBUG) {
        console.error(error)
      }

      process.exit(1)
    }
  }
}

/**
 * Enhanced Commander.js program with Refract branding
 */
export function createProgram(): Command {
  const program = new Command()

  program
    .name('refract')
    .description('Modern TypeScript-native ORM with declarative schema syntax')
    .version('0.0.0') // Will be replaced during build
    .option('-d, --debug', 'Enable debug output')
    .hook('preAction', (thisCommand) => {
      // Set debug mode if flag is present
      if (thisCommand.opts().debug) {
        process.env.DEBUG = '1'
      }
    })

  // Global error handler
  program.exitOverride((err) => {
    if (err.code === 'commander.help') {
      // Help was displayed, exit normally
      process.exit(0)
    } else if (err.code === 'commander.version') {
      // Version was displayed, exit normally
      process.exit(0)
    } else {
      // Other errors
      logger.error(`Command failed: ${err.message}`)
      process.exit(1)
    }
  })

  return program
}

/**
 * Add common command options
 */
export function addCommonOptions(command: Command): Command {
  return command
    .option('--schema <path>', 'Path to schema file (overrides config)')
    .option('--config <path>', 'Path to config file')
}

/**
 * Wrapper for command actions with error handling
 */
export function withErrorHandling<T extends any[]>(
  action: (...args: T) => Promise<void>,
): (...args: T) => Promise<void> {
  return async (...args: T) => {
    try {
      await action(...args)
    } catch (error) {
      logger.error(`Command failed: ${error instanceof Error ? error.message : String(error)}`)

      if (process.env.DEBUG) {
        console.error(error)
      }

      process.exit(1)
    }
  }
}
