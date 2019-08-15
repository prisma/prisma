#!/usr/bin/env ts-node
import * as Sentry from '@sentry/node'
import dotenv = require('dotenv')
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

/**
 * Dependencies
 */
import { isError, HelpError, Env, getCwd } from '@prisma/cli'
import { LiftCommand, LiftSave, LiftUp, LiftDown, LiftWatch } from '@prisma/lift'
import { Converter } from '@prisma/photon'
import { CLI } from './CLI'
import { Introspect, Init } from '@prisma/introspection'
import { Version } from './Version'
import { predefinedGenerators } from './generators'
import { Generate } from './Generate'
import chalk from 'chalk'
import { capture } from './capture'
import { Docs } from './Docs'
export { Photon } from '@prisma/studio-transports'

/**
 * Main function
 */
async function main(): Promise<number> {
  // react shut up
  process.env.NODE_ENV = 'production'
  // load the environment
  const env = await Env.load(process.env, await getCwd())
  if (isError(env)) {
    console.error(env)
    return 1
  }

  // create a new CLI with our subcommands
  const cli = CLI.new({
    init: Init.new(env),
    lift: LiftCommand.new(
      {
        save: LiftSave.new(env),
        up: LiftUp.new(env),
        down: LiftDown.new(env),
        docs: Docs.new('lift', 'https://github.com/prisma/prisma2/tree/master/docs'),
      },
      env,
    ),
    introspect: Introspect.new(env),
    convert: Converter.new(env),
    dev: LiftWatch.new(env, predefinedGenerators),
    generate: Generate.new(env, predefinedGenerators),
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
      capture(err)
      if (debugLib.enabled('prisma')) {
        console.error(chalk.redBright.bold('Error: ') + err.stack)
      } else {
        console.error(chalk.redBright.bold('Error: ') + err.message)
      }
      process.exit(1)
    })
}
