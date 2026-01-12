#!/usr/bin/env node

/**
 * Ork CLI - Main entry point
 */

import { registerGenerateCommand } from './commands/generate.js'
import { registerInitCommand } from './commands/init.js'
import { registerMigrateCommand } from './commands/migrate.js'
import { registerDevCommand } from './commands/dev.js'
import { createProgram } from './utils/command.js'
import { logger } from './utils/logger.js'

async function main() {
  const program = createProgram()

  // Register commands
  registerInitCommand(program)
  registerMigrateCommand(program)
  registerGenerateCommand(program)
  registerDevCommand(program)

  // Show help if no command provided
  if (process.argv.length <= 2) {
    program.help()
  }

  // Parse command line arguments
  await program.parseAsync(process.argv)
}

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  logger.error(`Unhandled Rejection at: ${promise}, reason: ${reason}`)
  process.exit(1)
})

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  logger.error(`Uncaught Exception: ${error.message}`)
  if (process.env.DEBUG) {
    console.error(error)
  }
  process.exit(1)
})

// Run the CLI
main().catch((error) => {
  logger.error(`CLI failed: ${error.message}`)
  if (process.env.DEBUG) {
    console.error(error)
  }
  process.exit(1)
})
