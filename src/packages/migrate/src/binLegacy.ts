#!/usr/bin/env ts-node

process.on('uncaughtException', (e) => {
  logger.log(e)
})
process.on('unhandledRejection', (e, promise) => {
  logger.log(String(e), String(promise))
})

process.env.NODE_NO_WARNINGS = '1'

/**
 * Dependencies
 */
import chalk from 'chalk'
import debugLib from 'debug'
import { HelpError, isError, logger } from '@prisma/sdk'
import { MigrateCommand } from './commands/legacy/MigrateCommand'
import { MigrateDown } from './commands/legacy/MigrateDown'
import { MigrateSave } from './commands/legacy/MigrateSave'
import { MigrateTmpPrepare } from './commands/legacy/MigrateTmpPrepare'
import { MigrateUp } from './commands/legacy/MigrateUp'
import { handlePanic } from './utils/handlePanic'

const packageJson = eval(`require('../package.json')`) // tslint:disable-line

/**
 * Main function
 */
async function main(): Promise<number> {
  // create a new CLI with our subcommands
  const cli = MigrateCommand.new({
    save: MigrateSave.new(),
    up: MigrateUp.new(),
    down: MigrateDown.new(),
    ['tmp-prepare']: MigrateTmpPrepare.new(),
  })
  // parse the arguments
  const result = await cli.parse(process.argv.slice(2))
  if (result instanceof HelpError) {
    logger.error(result)
    return 1
  } else if (isError(result)) {
    logger.error(result)
    return 1
  }
  logger.log(result)

  return 0
}
process.on('SIGINT', () => {
  process.exit(1) // now the "exit" event will fire
})

/**
 * Run our program
 */
main()
  .then((code) => {
    if (code !== 0) {
      process.exit(code)
    }
  })
  .catch((error) => {
    if (error.rustStack) {
      handlePanic(error, packageJson.version, packageJson.prisma.version)
        .catch((e) => {
          if (debugLib.enabled('migrate')) {
            logger.error(e.stack)
          } else {
            logger.error(e.message)
          }
        })
        .finally(() => {
          process.exit(1)
        })
    } else {
      if (debugLib.enabled('migrate')) {
        logger.error(error.stack)
      } else {
        logger.error(error.message)
      }
      process.exit(1)
    }
  })
