#!/usr/bin/env ts-node

import Debug from '@prisma/debug'
import { enginesVersion } from '@prisma/engines'
import { arg, handlePanic, HelpError, isCurrentBinInstalledGlobally, isError, isRustPanic } from '@prisma/internals'
import {
  DbCommand,
  DbExecute,
  DbPull,
  DbPush,
  // DbDrop,
  DbSeed,
  MigrateCommand,
  MigrateDeploy,
  MigrateDev,
  MigrateDiff,
  MigrateReset,
  MigrateResolve,
  MigrateStatus,
} from '@prisma/migrate'
import chalk from 'chalk'
import path from 'path'

import { CLI } from './CLI'
import { Dev } from './Dev'
import { Doctor } from './Doctor'
import { Format } from './Format'
import { Generate } from './Generate'
import { Init } from './Init'
/*
  When running bin.ts with ts-node with DEBUG="*"
  This error shows and blocks the execution
  Quick hack is to comment the Studio import and usage to use the CLI without building it...
  prisma:cli Error: Cannot find module '@prisma/internals'
  prisma:cli Require stack:
  prisma:cli - /Users/j42/Dev/prisma-meow/node_modules/.pnpm/@prisma+studio-pcw@0.456.0/node_modules/@prisma/studio-pcw/dist/index.js
*/
import { Studio } from './Studio'
import { Telemetry } from './Telemetry'
import { redactCommandArray, runCheckpointClientCheck } from './utils/checkpoint'
import { detectPrisma1 } from './utils/detectPrisma1'
import { printUpdateMessage } from './utils/printUpdateMessage'
import { Validate } from './Validate'
import { Version } from './Version'

// eslint-disable-next-line @typescript-eslint/no-var-requires, @typescript-eslint/no-unsafe-assignment
const packageJson = require('../package.json')

const commandArray = process.argv.slice(2)

process.removeAllListeners('warning')

const debug = Debug('prisma:cli')
process.on('uncaughtException', (e) => {
  debug(e)
})
process.on('unhandledRejection', (e) => {
  debug(e)
})

if (process.argv.length > 1 && process.argv[1].endsWith('prisma2')) {
  console.log(
    chalk.yellow('deprecated') +
      `  The ${chalk.redBright('prisma2')} command is deprecated and has been renamed to ${chalk.greenBright(
        'prisma',
      )}.\nPlease execute ${chalk.bold.greenBright(
        'prisma' + (commandArray.length ? ' ' + commandArray.join(' ') : ''),
      )} instead.\n`,
  )
}

// Parse CLI arguments
const args = arg(
  commandArray,
  {
    '--schema': String,
    '--telemetry-information': String,
  },
  false,
  true,
)

// Redact the command options and make it a string
const redactedCommandAsString = redactCommandArray([...commandArray]).join(' ')

// because chalk ...
if (process.env.NO_COLOR) {
  chalk.level = 0
}

const isPrismaInstalledGlobally = isCurrentBinInstalledGlobally()

/**
 * Main function
 */
async function main(): Promise<number> {
  // create a new CLI with our subcommands

  detectPrisma1()

  const cli = CLI.new(
    {
      init: Init.new(),
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
      /**
       * @deprecated since version 2.30.0, use `db pull` instead (renamed)
       */
      introspect: DbPull.new(),
      studio: Studio.new(),
      generate: Generate.new(),
      version: Version.new(),
      validate: Validate.new(),
      format: Format.new(),
      doctor: Doctor.new(),
      telemetry: Telemetry.new(),
      // TODO remove Legacy
      dev: Dev.new(),
    },
    [
      'version',
      'init',
      'migrate',
      'db',
      'introspect',
      'studio',
      'generate',
      'validate',
      'format',
      'doctor',
      'telemetry',
    ],
  )
  // parse the arguments
  const result = await cli.parse(commandArray)

  if (result instanceof HelpError) {
    console.error(result.message)
    return 1
  } else if (isError(result)) {
    console.error(result)
    return 1
  }
  console.log(result)

  /**
   * Prepare data and run the Checkpoint Client
   * See function for more info
   */
  const checkResult = await runCheckpointClientCheck({
    command: redactedCommandAsString,
    isPrismaInstalledGlobally,
    schemaPath: args['--schema'],
    telemetryInformation: args['--telemetry-information'],
    version: packageJson.version,
  })
  // if the result is cached and CLI outdated, show the `Update available` message
  const shouldHide = process.env.PRISMA_HIDE_UPDATE_MESSAGE
  if (checkResult && checkResult.status === 'ok' && checkResult.data.outdated && !shouldHide) {
    printUpdateMessage(checkResult)
  }

  return 0
}

process.on('SIGINT', () => {
  process.exit(0) // now the "exit" event will fire
})

/**
 * Run our program
 */
if (eval('require.main === module')) {
  main()
    .then((code) => {
      if (code !== 0) {
        process.exit(code)
      }
    })
    .catch((err) => {
      // Sindre's pkg p-map & co are using AggregateError, it is an iterator.
      if (typeof err[Symbol.iterator] === 'function') {
        for (const individualError of err) {
          handleIndividualError(individualError)
        }
      } else {
        handleIndividualError(err)
      }
    })
}

function handleIndividualError(error: Error): void {
  if (isRustPanic(error)) {
    handlePanic(error, packageJson.version, enginesVersion, redactedCommandAsString)
      .catch((e) => {
        if (Debug.enabled('prisma')) {
          console.error(chalk.redBright.bold('Error: ') + e.stack)
        } else {
          console.error(chalk.redBright.bold('Error: ') + e.message)
        }
      })
      .finally(() => {
        process.exit(1)
      })
  } else {
    if (Debug.enabled('prisma')) {
      console.error(chalk.redBright.bold('Error: ') + error.stack)
    } else {
      console.error(chalk.redBright.bold('Error: ') + error.message)
    }
    process.exit(1)
  }
}

/**
 * Annotations for `pkg` so it bundles things correctly with yarn's hoisting
 * `node_modules/prisma/build/index.js` needs to get to:
 * `node_modules/@prisma/engines`
 */

// macOS
path.join(__dirname, '../../engines/query-engine-darwin')
path.join(__dirname, '../../engines/introspection-engine-darwin')
path.join(__dirname, '../../engines/migration-engine-darwin')
path.join(__dirname, '../../engines/prisma-fmt-darwin')
// Windows
path.join(__dirname, '../../engines/query-engine-windows.exe')
path.join(__dirname, '../../engines/introspection-engine-windows.exe')
path.join(__dirname, '../../engines/migration-engine-windows.exe')
path.join(__dirname, '../../engines/prisma-fmt-windows.exe')

// Debian openssl-1.0.x
path.join(__dirname, '../../engines/query-engine-debian-openssl-1.0.x')
path.join(__dirname, '../../engines/introspection-engine-debian-openssl-1.0.x')
path.join(__dirname, '../../engines/migration-engine-debian-openssl-1.0.x')
path.join(__dirname, '../../engines/prisma-fmt-debian-openssl-1.0.x')
// Debian openssl-1.1.x
path.join(__dirname, '../../engines/query-engine-debian-openssl-1.1.x')
path.join(__dirname, '../../engines/introspection-engine-debian-openssl-1.1.x')
path.join(__dirname, '../../engines/migration-engine-debian-openssl-1.1.x')
path.join(__dirname, '../../engines/prisma-fmt-debian-openssl-1.1.x')
// Debian openssl-3.0.x
path.join(__dirname, '../../engines/query-engine-debian-openssl-3.0.x')
path.join(__dirname, '../../engines/introspection-engine-debian-openssl-3.0.x')
path.join(__dirname, '../../engines/migration-engine-debian-openssl-3.0.x')
path.join(__dirname, '../../engines/prisma-fmt-debian-openssl-3.0.x')

// Red Hat Enterprise Linux openssl-1.0.x
path.join(__dirname, '../../engines/query-engine-rhel-openssl-1.0.x')
path.join(__dirname, '../../engines/introspection-engine-rhel-openssl-1.0.x')
path.join(__dirname, '../../engines/migration-engine-rhel-openssl-1.0.x')
path.join(__dirname, '../../engines/prisma-fmt-rhel-openssl-1.0.x')
// Red Hat Enterprise Linux openssl-1.1.x
path.join(__dirname, '../../engines/query-engine-rhel-openssl-1.1.x')
path.join(__dirname, '../../engines/introspection-engine-rhel-openssl-1.1.x')
path.join(__dirname, '../../engines/migration-engine-rhel-openssl-1.1.x')
path.join(__dirname, '../../engines/prisma-fmt-rhel-openssl-1.1.x')
// Red Hat Enterprise Linux openssl-3.0.x
path.join(__dirname, '../../engines/query-engine-rhel-openssl-3.0.x')
path.join(__dirname, '../../engines/introspection-engine-rhel-openssl-3.0.x')
path.join(__dirname, '../../engines/migration-engine-rhel-openssl-3.0.x')
path.join(__dirname, '../../engines/prisma-fmt-rhel-openssl-3.0.x')
