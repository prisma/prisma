#!/usr/bin/env ts-node

import Debug from '@prisma/debug'
import { enginesVersion } from '@prisma/engines-version'
import { handlePanic, HelpError, isError } from '@prisma/internals'
import chalk from 'chalk'

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
// Listen to Ctr + C and exit
process.on('SIGINT', () => {
  process.exit(130)
})

const commandArray = process.argv.slice(2)

const packageJson = eval(`require('../package.json')`)

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

  // Execute the command
  const result = await cli.parse(commandArray)
  // Did it error?
  if (result instanceof HelpError) {
    console.error(result)
    // TODO: We could do like Bash (and other)
    // = return an exit status of 2 to indicate incorrect usage like invalid options or missing arguments.
    // https://tldp.org/LDP/abs/html/exitcodes.html
    return 1
  } else if (isError(result)) {
    console.error(result)
    return 1
  }

  // Success
  console.log(result)
  return 0
}

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
      handlePanic(error, packageJson.version, enginesVersion, commandArray.join(' '))
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
