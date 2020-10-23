#!/usr/bin/env ts-node

// hides ExperimentalWarning: The fs.promises API is experimental
process.env.NODE_NO_WARNINGS = '1'

import {
  arg,
  getCLIPathHash,
  getProjectHash,
  getSchema,
  getConfig,
  tryLoadEnv,
} from '@prisma/sdk'
import chalk from 'chalk'

// eslint-disable-next-line @typescript-eslint/no-var-requires, @typescript-eslint/no-unsafe-assignment
const packageJson = require('../package.json')

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

// If running via `ts-node`, treat NODE_ENV as development
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
if (process[Symbol.for('ts-node.register.instance')]) {
  process.env.NODE_ENV = 'development'
} else {
  // react: psst 🙊
  process.env.NODE_ENV = 'production'
}

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
// if the CLI is called without any command like `prisma` we can ignore .env loading
if (process.argv.length > 2) {
  tryLoadEnv(args)
}

/**
 * Dependencies
 */
import * as checkpoint from 'checkpoint-client'
import { isError, HelpError } from '@prisma/sdk'
import {
  MigrateCommand,
  MigrateSave,
  MigrateUp,
  MigrateDown,
  MigrateTmpPrepare,
  DbPush,
  DbDrop,
  DbCommand,
  handlePanic,
} from '@prisma/migrate'

import { CLI } from './CLI'
import { Init } from './Init'
import { Introspect } from './Introspect'
import { Dev } from './Dev'
import { Version } from './Version'
import { Generate } from './Generate'
import { ProviderAliases, isCurrentBinInstalledGlobally } from '@prisma/sdk'
import { Validate } from './Validate'
import { Format } from './Format'
import { Doctor } from './Doctor'
import { Studio } from './Studio'
import { Telemetry } from './Telemetry'
import { printUpdateMessage } from './utils/printUpdateMessage'

// aliases are only used by @prisma/studio, but not for users anymore,
// as they have to ship their own version of @prisma/client
const aliases: ProviderAliases = {
  'prisma-client-js': {
    generatorPath: `node --max-old-space-size=8096 "${eval(
      `require('path').join(__dirname, '../prisma-client/generator-build/index.js')`,
    )}"`, // all evals are here for ncc
    outputPath: eval(`require('path').join(__dirname, '../prisma-client/')`),
  },
}

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
  const cli = CLI.new(
    {
      init: Init.new(),
      migrate: MigrateCommand.new({
        save: MigrateSave.new(),
        up: MigrateUp.new(),
        down: MigrateDown.new(),
      }),
      db: DbCommand.new({
        push: DbPush.new(),
        // drop: DbDrop.new(),
      }),
      'tmp-prepare': MigrateTmpPrepare.new(),
      introspect: Introspect.new(),
      dev: Dev.new(),
      studio: Studio.new(aliases),
      generate: Generate.new(),
      version: Version.new(),
      validate: Validate.new(),
      format: Format.new(),
      doctor: Doctor.new(),
      telemetry: Telemetry.new(),
    },
    [
      'version',
      'init',
      'migrate',
      'db',
      'tmp-prepare',
      'introspect',
      'dev',
      'studio',
      'generate',
      'validate',
      'format',
      'doctor',
      'telemetry',
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

  try {
    // SHA256 identifier for the project based on the prisma schema path
    const projectPathHash = await getProjectHash()
    // SHA256 of the cli path
    const cliPathHash = getCLIPathHash()

    let schemaProviders: string[] | undefined
    let schemaPreviewFeatures: string[] | undefined
    let schemaGeneratorsProviders: string[] | undefined
    try {
      const schema = await getSchema(args['--schema'])
      const config = await getConfig({
        datamodel: schema,
      })
      if (config.datasources.length > 0) {
        schemaProviders = config.datasources[0].provider
      }
      const generator = config.generators.find(
        (gen) => gen.previewFeatures.length > 0,
      )
      if (generator) {
        schemaPreviewFeatures = generator.previewFeatures
      }
      // Example 'prisma-client-js'
      schemaGeneratorsProviders = config.generators.map((gen) => gen.provider)
    } catch (e) {
      //
      debug(e)
    }

    // check prisma for updates
    const checkResult = await checkpoint.check({
      product: 'prisma',
      cli_path_hash: cliPathHash,
      project_hash: projectPathHash,
      version: packageJson.version,
      schema_providers: schemaProviders,
      schema_preview_features: schemaPreviewFeatures,
      schema_generators_providers: schemaGeneratorsProviders,
      cli_path: process.argv[1],
      cli_install_type: isPrismaInstalledGlobally ? 'global' : 'local',
      command: process.argv.slice(2).join(' '),
      information:
        args['--telemetry-information'] ||
        process.env.PRISMA_TELEMETRY_INFORMATION,
    })
    // if the result is cached and we're outdated, show this prompt
    const shouldHide = process.env.PRISMA_HIDE_UPDATE_MESSAGE
    if (
      checkResult.status === 'ok' &&
      checkResult.data.outdated &&
      !shouldHide
    ) {
      printUpdateMessage(checkResult)
    }
  } catch (e) {
    debug(e)
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
    .then((code) => {
      if (code !== 0) {
        process.exit(code)
      }
    })
    .catch((err) => {
      function handleIndividualError(error): void {
        if (error.rustStack) {
          handlePanic(error, packageJson.version, packageJson.prisma.version)
            .catch((e) => {
              if (debugLib.enabled('prisma')) {
                console.error(chalk.redBright.bold('Error: ') + e.stack)
              } else {
                console.error(chalk.redBright.bold('Error: ') + e.message)
              }
            })
            .finally(() => {
              process.exit(1)
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
