#!/usr/bin/env ts-node

process.env.NODE_NO_WARNINGS = '1'

process.on('uncaughtException', (e) => {
  console.log(e)
})
process.on('unhandledRejection', (e, promise) => {
  console.log(String(e), String(promise))
})

import {
  HelpError,
  isError,
  ProviderAliases,
  tryLoadEnv,
  arg,
} from '@prisma/sdk'

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
// if the CLI is called without any command like `up --experimental` we can ignore .env loading
// should be 2 but because of --experimental flag it will be 3 until removed
if (process.argv.length > 3) {
  tryLoadEnv(args['--schema'])
}

/**
 * Dependencies
 */
import chalk from 'chalk'
import debugLib from 'debug'

import { MigrateCommand } from './commands/MigrateCommand'
import { MigrateSave } from './commands/MigrateSave'
import { MigrateDown } from './commands/MigrateDown'
import { MigrateUp } from './commands/MigrateUp'
import { DbPush } from './commands/DbPush'
import { DbDrop } from './commands/DbDrop'
import { MigrateTmpPrepare } from './commands/MigrateTmpPrepare'
import { handlePanic } from './utils/handlePanic'

const debug = debugLib('migrate')

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
    push: DbPush.new(),
    drop: DbDrop.new(),
    ['tmp-prepare']: MigrateTmpPrepare.new(),
  })
  // parse the arguments
  const result = await cli.parse(process.argv.slice(2))
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
      handlePanic(error, packageJson.version, packageJson.prisma.version)
        .catch((e) => {
          if (debugLib.enabled('migrate')) {
            console.error(chalk.redBright.bold('Error: ') + e.stack)
          } else {
            console.error(chalk.redBright.bold('Error: ') + e.message)
          }
        })
        .finally(() => {
          process.exit(1)
        })
    } else {
      if (debugLib.enabled('migrate')) {
        console.error(chalk.redBright.bold('Error: ') + error.stack)
      } else {
        console.error(chalk.redBright.bold('Error: ') + error.message)
      }
      process.exit(1)
    }
  })
