#!/usr/bin/env ts-node
import fs from 'fs'
import { promisify } from 'util'
import path from 'path'
import dotenv from 'dotenv'
import chalk from 'chalk'
import crypto from 'crypto'
import { arg, drawBox } from '@prisma/sdk'
const packageJson = require('../package.json') // eslint-disable-line @typescript-eslint/no-var-requires

const exists = promisify(fs.exists)

export { byline } from '@prisma/migrate'

// do this before facebook's yoga
import debugLib from 'debug'

const debug = debugLib('prisma')
process.on('uncaughtException', (e) => {
  debug(e)
})
process.on('unhandledRejection', (e) => {
  debug(e)
})

// warnings: no tanks
// hides ExperimentalWarning: The fs.promises API is experimental
process.env.NODE_NO_WARNINGS = '1'

// react: psst 🙊
process.env.NODE_ENV = 'production'

if (process.argv.length > 1 && process.argv[1].endsWith('prisma2')) {
  console.log(
    chalk.yellow('deprecated') +
      `  The ${chalk.redBright(
        'prisma2',
      )} command is deprecated and has been renamed to ${chalk.greenBright(
        'prisma',
      )}.\nPlease execute ${chalk.bold.greenBright(
        'prisma' +
          (process.argv.length > 2
            ? ' ' + process.argv.slice(2).join(' ')
            : ''),
      )} instead.\n`,
  )
}

//
// Read .env file only if next to schema.prisma
//
// if the CLI is called witout any comand like `prisma` we can ignore .env loading
if (process.argv.length > 2) {
  let dotenvResult

  // Parse CLI arguments and look for --schema
  const args = arg(process.argv.slice(3), { '--schema': String })

  // Check --schema directory
  if (args && args['--schema']) {
    const dotenvFilepath = path.join(path.dirname(args['--schema']), '.env')

    if (fs.existsSync(args['--schema']) && fs.existsSync(dotenvFilepath)) {
      dotenvResult = dotenv.config({ path: dotenvFilepath })
      console.log(
        chalk.dim(
          'Environment variables loaded from provided --schema directory',
        ),
      )
    } else {
      debug('Environment variables not loaded (--schema was provided)')
    }
  } // Check current directory
  else if (fs.existsSync('schema.prisma') && fs.existsSync('.env')) {
    dotenvResult = dotenv.config()
    console.log(
      chalk.dim('Environment variables loaded from current directory'),
    )
  } // Check ./prisma directory
  else if (
    fs.existsSync('prisma/schema.prisma') &&
    fs.existsSync('prisma/.env')
  ) {
    dotenvResult = dotenv.config({ path: 'prisma/.env' })
    console.log(chalk.dim('Environment variables loaded from ./prisma/.env'))
  } // We didn't find a .env file next to the prisma.schema file.
  else {
    debug('Environment variables not loaded')
  }
  // Print the error if any (if internal dotenv readFileSync throws)
  if (dotenvResult && dotenvResult.error) {
    console.error(chalk.redBright.bold('Error: ') + dotenvResult.error)
  }
}

/**
 * Dependencies
 */
import { isError, HelpError } from '@prisma/sdk'
import {
  MigrateCommand,
  MigrateSave,
  MigrateUp,
  MigrateDown,
  MigrateTmpPrepare,
  StudioCommand,
  handlePanic,
} from '@prisma/migrate'
import { CLI } from './CLI'
import { Introspect, Init } from '@prisma/introspection'
import { Dev } from './Dev'
import { Version } from './Version'
import { Generate } from './Generate'
import { ProviderAliases } from '@prisma/sdk'
import { Validate } from './Validate'
import * as checkpoint from 'checkpoint-client'
import ci from '@prisma/ci-info'
import { Format } from './Format'

// aliases are only used by @prisma/studio, but not for users anymore,
// as they have to ship their own version of @prisma/client
const aliases: ProviderAliases = {
  'prisma-client-js': {
    generatorPath: eval(
      `require('path').join(__dirname, '../prisma-client/generator-build/index.js')`,
    ), // all evals are here for ncc
    outputPath: eval(`require('path').join(__dirname, '../prisma-client/')`),
  },
}

// because chalk ...
if (process.env.NO_COLOR) {
  chalk.level = 0
}

/**
 * Main function
 */
async function main(): Promise<number> {
  // create a new CLI with our subcommands
  const cli = CLI.new(
    {
      init: Init.new(),
      migrate: MigrateCommand.new({
        save: MigrateSave.new(),
        up: MigrateUp.new(),
        down: MigrateDown.new(),
      }),
      'tmp-prepare': MigrateTmpPrepare.new(),
      introspect: Introspect.new(),
      dev: Dev.new(),
      studio: StudioCommand.new(aliases),
      generate: Generate.new(),
      version: Version.new(),
      validate: Validate.new(),
      format: Format.new(),
    },
    [
      'version',
      'init',
      'migrate',
      'tmp-prepare',
      'introspect',
      'dev',
      'studio',
      'generate',
      'validate',
      'format',
    ],
  )
  // parse the arguments
  const result = await cli.parse(process.argv.slice(2))
  if (result instanceof HelpError) {
    console.error(result.message)
    return 1
  } else if (isError(result)) {
    console.error(result)
    return 1
  }
  console.log(result)

  // Project hash is a SHA256 of the schemaPath
  const projectHash = await getProjectHash()
  // SHA256 of the cli path
  const cliPathHash = await getCLIPathHash()

  // check prisma for updates
  const checkResult = await checkpoint.check({
    product: 'prisma',
    cli_path_hash: cliPathHash,
    project: projectHash,
    version: packageJson.version,
    disable: ci.isCI,
  })
  // if the result is cached and we're outdated, show this prompte
  if (checkResult.status === 'ok' && checkResult.data.outdated) {
    console.error(
      drawBox({
        height: 4,
        width: 59,
        str: `\n${chalk.blue('Update available')} ${packageJson.version} -> ${
          checkResult.data.current_version
        }\nRun ${chalk.bold(checkResult.data.install_command)} to update`,
        horizontalPadding: 2,
      }),
    )
  }

  return 0
}

/**
 * Get a unique identifier for the project by hashing
 * the directory with `schema.prisma`
 */
async function getProjectHash(): Promise<string> {
  const schemaPath = await getSchemaPath()

  return crypto
    .createHash('sha256')
    .update(schemaPath)
    .digest('hex')
    .substring(0, 8)
}
/**
 * Get a unique identifier for the CLI instllation path
 * which can be either global or local (in project's node_modules)
 */
async function getCLIPathHash(): Promise<string> {
  const cliPath = process.argv[1]
  return crypto
    .createHash('sha256')
    .update(cliPath)
    .digest('hex')
    .substring(0, 8)
}

/**
 * Get the path where `schema.prisma` lives
 */
async function getSchemaPath(): Promise<string> {
  const cwd = process.cwd()
  const prismaSchemaFile = 'schema.prisma'

  if (await exists(path.join(cwd, prismaSchemaFile))) {
    return cwd
  }

  if (await exists(path.join(cwd, 'prisma', prismaSchemaFile))) {
    return path.normalize(path.join(cwd, 'prisma'))
  }

  // Default to cwd if prisma schema couldn't be found
  return cwd
}

process.on('SIGINT', () => {
  process.exit(0) // now the "exit" event will fire
})

/**
 * Run our program
 */
if (require.main === module) {
  main()
    .then((code) => {
      if (code !== 0) {
        process.exit(code)
      }
    })
    .catch((err) => {
      function handleIndividualError(error): void {
        if (error.rustStack) {
          handlePanic(
            error,
            packageJson.version,
            packageJson.prisma.version,
          ).catch((e) => {
            if (debugLib.enabled('prisma')) {
              console.error(chalk.redBright.bold('Error: ') + e.stack)
            } else {
              console.error(chalk.redBright.bold('Error: ') + e.message)
            }
          })
        } else {
          if (debugLib.enabled('prisma')) {
            console.error(chalk.redBright.bold('Error: ') + error.stack)
          } else {
            console.error(chalk.redBright.bold('Error: ') + error.message)
          }
          process.exit(1)
        }
      }

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
