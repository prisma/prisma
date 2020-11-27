#!/usr/bin/env ts-node

process.env.NODE_NO_WARNINGS = '1'

process.on('uncaughtException', (e) => {
  console.log(e)
})
process.on('unhandledRejection', (e, promise) => {
  console.log(String(e), String(promise))
})

import { HelpError, isError, tryLoadEnvs, arg, getEnvPaths } from '@prisma/sdk'

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
// if the CLI is called without any command like `up --early-access-feature` we can ignore .env loading
// should be 1 but because of --early-access-feature flag it will be 2 until removed
if (process.argv.length > 3) {
  try {
    const envPaths = getEnvPaths(args['--schema'])
    const envData = tryLoadEnvs(envPaths, { conflictCheck: 'error' })
    envData && console.log(envData.message)
  } catch (e) {
    console.log(e)
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
import { MigrateTmpPrepare } from './commands/legacy/MigrateTmpPrepare'
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
      handlePanic(error, packageJson.version, enginesVersion)
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
