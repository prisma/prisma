#!/usr/bin/env ts-node

process.env.NODE_NO_WARNINGS = '1'

process.on('uncaughtException', (e) => {
  logger.log(e)
})
process.on('unhandledRejection', (e, promise) => {
  logger.log(String(e), String(promise))
})

import { HelpError, isError, tryLoadEnvs, arg, getEnvPaths, logger } from '@prisma/sdk'

// Parse CLI arguments
const args = arg(
  process.argv.slice(2),
  {
    '--schema': String,
    '--telemetry-information': String,
  },
  false,
  true,
)

//
// Read .env file only if next to schema.prisma
//
// if the CLI is called without any command like `dev` we can ignore .env loading
if (process.argv.length > 2) {
  try {
    const envPaths = getEnvPaths(args['--schema'])
    const envData = tryLoadEnvs(envPaths, { conflictCheck: 'error' })
    envData && envData.message && logger.log(envData.message)
  } catch (e) {
    logger.log(e)
  }
}

/**
 * Dependencies
 */
import chalk from 'chalk'
import debugLib from 'debug'

import { MigrateCommand } from './commands/MigrateCommand'
import { MigrateDev } from './commands/MigrateDev'
import { MigrateReset } from './commands/MigrateReset'
import { MigrateDeploy } from './commands/MigrateDeploy'
import { MigrateResolve } from './commands/MigrateResolve'
import { MigrateStatus } from './commands/MigrateStatus'
import { DbPush } from './commands/DbPush'
import { DbDrop } from './commands/DbDrop'
import { handlePanic } from './utils/handlePanic'
import { enginesVersion } from '@prisma/engines-version'

const packageJson = eval(`require('../package.json')`) // tslint:disable-line

/**
 * Main function
 */
async function main(): Promise<number> {
  // create a new CLI with our subcommands
  const cli = MigrateCommand.new({
    dev: MigrateDev.new(),
    reset: MigrateReset.new(),
    deploy: MigrateDeploy.new(),
    status: MigrateStatus.new(),
    resolve: MigrateResolve.new(),
    // for convenient debugging
    push: DbPush.new(),
    drop: DbDrop.new(),
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
      handlePanic(error, packageJson.version, enginesVersion)
        .catch((e) => {
          if (debugLib.enabled('migrate')) {
            logger.error(chalk.redBright.bold('Error: ') + e.stack)
          } else {
            logger.error(chalk.redBright.bold('Error: ') + e.message)
          }
        })
        .finally(() => {
          process.exit(1)
        })
    } else {
      if (debugLib.enabled('migrate')) {
        logger.error(chalk.redBright.bold('Error: ') + error.stack)
      } else {
        logger.error(chalk.redBright.bold('Error: ') + error.message)
      }
      process.exit(1)
    }
  })
