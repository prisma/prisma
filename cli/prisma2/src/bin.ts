#!/usr/bin/env ts-node

import * as Sentry from '@sentry/node'
import fs from 'fs'
import path from 'path'
import dotenv from 'dotenv'
import chalk from 'chalk'
import { arg } from '@prisma/sdk'
const packageJson = require('../package.json')

export { byline } from '@prisma/migrate'
export { Sentry }

// do this before facebook's yoga
import debugLib from 'debug'

const debug = debugLib('prisma')
process.on('uncaughtException', e => {
  debug(e)
})
process.on('unhandledRejection', e => {
  debug(e)
})

// warnings: no tanks
// hides ExperimentalWarning: The fs.promises API is experimental
process.env.NODE_NO_WARNINGS = '1'

// react: psst 🙊
process.env.NODE_ENV = 'production'

//
// Read .env file only if next to schema.prisma
//
// if the CLI is called witout any comand like `prisma2` we can ignore .env loading
if (process.argv.length > 2) {
  let dotenvResult

  // Parse CLI arguments and look for --schema
  const args = arg(process.argv.slice(3), { '--schema': String })

  // Check --schema directory
  if (args && args['--schema']) {
    const dotenvFilepath = path.join(path.dirname(args['--schema']), '.env')

    if (fs.existsSync(args['--schema']) && fs.existsSync(dotenvFilepath)) {
      dotenvResult = dotenv.config({ path: dotenvFilepath })
      debug('.env loaded from provided --schema directory')
    } else {
      debug('.env not loaded (--schema was provided)')
    }
  } // Check current directory
  else if (fs.existsSync('schema.prisma') && fs.existsSync('.env')) {
    dotenvResult = dotenv.config()
    debug('.env loaded from current directory')
  } // Check ./prisma directory
  else if (fs.existsSync('prisma/schema.prisma') && fs.existsSync('prisma/.env')) {
    dotenvResult = dotenv.config({ path: 'prisma/.env' })
    debug('.env loaded from ./prisma/.env')
  } // We didn't find a .env file next to the prisma.schema file.
  else {
    debug('.env not loaded')
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
import { LiftCommand, LiftSave, LiftUp, LiftDown, LiftTmpPrepare, StudioCommand, handlePanic } from '@prisma/migrate'
import { CLI } from './CLI'
import { Introspect, Init } from '@prisma/introspection'
import { Dev } from './Dev'
import { Version } from './Version'
import { Generate } from './Generate'
import { ProviderAliases } from '@prisma/sdk'
import { Validate } from './Validate'
import * as checkpoint from 'checkpoint-client'
import ci from '@prisma/ci-info'

// aliases are only used by @prisma/studio, but not for users anymore,
// as they have to ship their own version of @prisma/client
const aliases: ProviderAliases = {
  'prisma-client-js': {
    generatorPath: eval(`require('path').join(__dirname, '../prisma-client/generator-build/index.js')`), // all evals are here for ncc
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
      migrate: LiftCommand.new({
        save: LiftSave.new(),
        up: LiftUp.new(),
        down: LiftDown.new(),
      }),
      'tmp-prepare': LiftTmpPrepare.new(),
      introspect: Introspect.new(),
      dev: Dev.new(),
      studio: StudioCommand.new(aliases),
      generate: Generate.new(),
      version: Version.new(),
      validate: Validate.new(),
    },
    ['init', 'lift', 'tmp-prepare', 'introspect', 'dev', 'studio', 'generate', 'validate'],
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
  // check prisma for updates
  const checkResult = await checkpoint.check({
    product: 'prisma',
    version: packageJson.version,
    disable: ci.isCI,
  })
  // if the result is cached and we're outdated, show this prompte
  if (checkResult.status === 'ok' && checkResult.data.outdated) {
    console.error(
      `\n${chalk.blue('Update available')} ${packageJson.version} -> ${
        checkResult.data.current_version
      }\nRun ${chalk.bold(checkResult.data.install_command)} to update`,
    )
  }

  return 0
}

process.on('SIGINT', () => {
  process.exit(0) // now the "exit" event will fire
})

/**
 * Run our program
 */
if (require.main === module) {
  main()
    .then(code => {
      if (code !== 0) {
        process.exit(code)
      }
    })
    .catch(err => {
      function handleIndividualError(error) {
        if (error.rustStack) {
          handlePanic(error, packageJson.name, packageJson.version).catch(e => {
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
