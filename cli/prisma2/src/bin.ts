#!/usr/bin/env ts-node
import * as Sentry from '@sentry/node'
import dotenv = require('dotenv')
const packageJson = require('../package.json')
dotenv.config()

export { byline } from '@prisma/lift'
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

/**
 * Dependencies
 */
import { isError, HelpError } from '@prisma/cli'
import {
  LiftCommand,
  LiftSave,
  LiftUp,
  LiftDown,
  LiftWatch,
  LiftTmpPrepare,
  StudioCommand,
  handlePanic,
} from '@prisma/lift'
import { CLI } from './CLI'
import { Introspect, Init } from '@prisma/introspection'
import { Version } from './Version'
import { Generate } from './Generate'
import chalk from 'chalk'
import { Docs } from './Docs'
import { Converter } from './Converter'
import { ProviderAliases } from '@prisma/sdk'
export { Photon } from '@prisma/studio-transports'

// aliases are only used by @prisma/studio, but not for users anymore,
// as they have to ship their own version of @prisma/photon
const aliases: ProviderAliases = {
  photonjs: {
    generatorPath: eval(`require('path').join(__dirname, '../photon/generator-build/index.js')`), // all evals are here for ncc
    outputPath: eval(`require('path').join(__dirname, '../photon/')`),
  },
}

/**
 * Main function
 */
async function main(): Promise<number> {
  // react shut up
  process.env.NODE_ENV = 'production'

  // create a new CLI with our subcommands
  const cli = CLI.new({
    init: Init.new(),
    lift: LiftCommand.new({
      save: LiftSave.new(),
      up: LiftUp.new(),
      down: LiftDown.new(),
      docs: Docs.new('lift', 'https://github.com/prisma/prisma2/tree/master/docs'),
    }),
    'tmp-prepare': LiftTmpPrepare.new(),
    introspect: Introspect.new(),
    convert: Converter.new(),
    dev: LiftWatch.new(aliases),
    studio: StudioCommand.new(aliases),
    generate: Generate.new(),
    version: Version.new(),
  })
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
        handlePanic(err, packageJson.name, packageJson.version)
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
