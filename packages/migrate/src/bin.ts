#!/usr/bin/env ts-node

import Debug from '@prisma/debug'
import { enginesVersion } from '@prisma/engines-version'
import { handlePanic, HelpError, isError } from '@prisma/sdk'
import chalk from 'chalk'

import { version } from '../package.json'
import { CLI } from './CLI'
import { DbCommand } from './commands/DbCommand'
import { DbExecute } from './commands/DbExecute'
import { DbPull } from './commands/DbPull'
import { DbPush } from './commands/DbPush'
// import { DbDrop } from './commands/DbDrop'
import { DbSeed } from './commands/DbSeed'
import { MigrateCommand } from './commands/MigrateCommand'
import { MigrateDeploy } from './commands/MigrateDeploy'
import { MigrateDev } from './commands/MigrateDev'
import { MigrateDiff } from './commands/MigrateDiff'
import { MigrateReset } from './commands/MigrateReset'
import { MigrateResolve } from './commands/MigrateResolve'
import { MigrateStatus } from './commands/MigrateStatus'

process.on('uncaughtException', (e) => {
  console.log(e)
})
process.on('unhandledRejection', (e, promise) => {
  console.log(String(e), String(promise))
})

const commandArray = process.argv.slice(2)

/**
 * Main function
 */
async function main(): Promise<number> {
  // create a new CLI with our subcommands
  const cli = CLI.new({
    migrate: MigrateCommand.new({
      dev: MigrateDev.new(),
      status: MigrateStatus.new(),
      resolve: MigrateResolve.new(),
      reset: MigrateReset.new(),
      deploy: MigrateDeploy.new(),
      diff: MigrateDiff.new(),
    }),
    db: DbCommand.new({
      execute: DbExecute.new(),
      pull: DbPull.new(),
      push: DbPush.new(),
      // drop: DbDrop.new(),
      seed: DbSeed.new(),
    }),
  })

  // parse the arguments
  const result = await cli.parse(commandArray)
  if (result instanceof HelpError) {
    console.error(result)
    return 1
  } else if (isError(result)) {
    console.error(result)
    return 1
  }
  console.log(result)

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
      handlePanic(error, version, enginesVersion, commandArray.join(' '))
        .catch((e) => {
          if (Debug.enabled('migrate')) {
            console.error(chalk.redBright.bold('Error: ') + e.stack)
          } else {
            console.error(chalk.redBright.bold('Error: ') + e.message)
          }
        })
        .finally(() => {
          process.exit(1)
        })
    } else {
      if (Debug.enabled('migrate')) {
        console.error(chalk.redBright.bold('Error: ') + error.stack)
      } else {
        console.error(chalk.redBright.bold('Error: ') + error.message)
      }
      process.exit(1)
    }
  })
