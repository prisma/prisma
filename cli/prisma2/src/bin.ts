#!/usr/bin/env ts-node
import * as Sentry from '@sentry/node'
import dotenv = require('dotenv')
const packageJson = require('../package.json')
dotenv.config()

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

/**
 * Dependencies
 */
import { isError, HelpError } from '@prisma/cli'
import { LiftCommand, LiftSave, LiftUp, LiftDown, LiftTmpPrepare, StudioCommand, handlePanic } from '@prisma/migrate'
import { CLI } from './CLI'
import { Introspect, Init } from '@prisma/introspection'
import { Dev } from './Dev'
import { Version } from './Version'
import { Generate } from './Generate'
import chalk from 'chalk'
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
      if (err.rustStack) {
        handlePanic(err, packageJson.name, packageJson.version).catch(e => {
          if (debugLib.enabled('prisma')) {
            console.error(chalk.redBright.bold('Error: ') + e.stack)
          } else {
            console.error(chalk.redBright.bold('Error: ') + e.message)
          }
        })
      } else {
        if (debugLib.enabled('prisma')) {
          console.error(chalk.redBright.bold('Error: ') + err.stack)
        } else {
          console.error(chalk.redBright.bold('Error: ') + err.message)
        }
        process.exit(1)
      }
    })
}
