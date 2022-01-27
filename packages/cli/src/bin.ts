#!/usr/bin/env ts-node

// hides ExperimentalWarning: The fs.promises API is experimental
process.env.NODE_NO_WARNINGS = '1'

import {
  arg,
  getCLIPathHash,
  getProjectHash,
  getSchema,
  getConfig,
  tryLoadEnvs,
  getEnvPaths,
  parseEnvValue,
} from '@prisma/sdk'
import chalk from 'chalk'

// eslint-disable-next-line @typescript-eslint/no-var-requires, @typescript-eslint/no-unsafe-assignment
const packageJson = require('../package.json')
const commandArray = process.argv.slice(2)

import Debug from '@prisma/debug'

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

//
// Read .env file only if next to schema.prisma
//
// if the CLI is called without any command like `prisma` we can ignore .env loading
if (commandArray.length) {
  try {
    const envPaths = getEnvPaths(args['--schema'])
    const envData = tryLoadEnvs(envPaths, { conflictCheck: 'error' })
    envData && envData.message && console.log(envData.message)
  } catch (e) {
    handleIndividualError(e)
  }
}

/**
 * Dependencies
 */
import * as checkpoint from 'checkpoint-client'
import { isError, HelpError } from '@prisma/sdk'
import {
  MigrateCommand,
  MigrateDev,
  MigrateResolve,
  MigrateStatus,
  MigrateReset,
  MigrateDeploy,
  MigrateDiff,
  DbExecute,
  DbPush,
  DbPull,
  // DbDrop,
  DbSeed,
  DbCommand,
  handlePanic,
} from '@prisma/migrate'

import { CLI } from './CLI'
import { Init } from './Init'
import { Dev } from './Dev'
import { Version } from './Version'
import { Generate } from './Generate'
import { isCurrentBinInstalledGlobally } from '@prisma/sdk'
import { Validate } from './Validate'
import { Format } from './Format'
import { Doctor } from './Doctor'
import { Studio } from './Studio'
import { Telemetry } from './Telemetry'
import { printUpdateMessage } from './utils/printUpdateMessage'
import { enginesVersion } from '@prisma/engines'
import path from 'path'
import { detectPrisma1 } from './utils/detectPrisma1'

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
      dev: Dev.new(),
      studio: Studio.new(),
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
  const result = await cli.parse(commandArray)

  if (result instanceof HelpError) {
    console.error(result.message)
    return 1
  } else if (isError(result)) {
    console.error(result)
    return 1
  }
  console.log(result)

  try {
    // SHA256 identifier for the project based on the Prisma schema path
    const projectPathHash = await getProjectHash()
    // SHA256 of the cli path
    const cliPathHash = getCLIPathHash()

    let schemaProvider: string | undefined
    let schemaPreviewFeatures: string[] | undefined
    let schemaGeneratorsProviders: string[] | undefined
    try {
      const schema = await getSchema(args['--schema'])
      const config = await getConfig({
        datamodel: schema,
        ignoreEnvVarErrors: true,
      })

      if (config.datasources.length > 0) {
        schemaProvider = config.datasources[0].provider
      }

      // restrict the search to previewFeatures of `provider = 'prisma-client-js'`
      // (this was not scoped to `prisma-client-js` before Prisma 3.0)
      const generator = config.generators.find(
        (generator) => parseEnvValue(generator.provider) === 'prisma-client-js' && generator.previewFeatures.length > 0,
      )
      if (generator) {
        schemaPreviewFeatures = generator.previewFeatures
      }

      // Example 'prisma-client-js'
      schemaGeneratorsProviders = config.generators.map((generator) => parseEnvValue(generator.provider))
    } catch (e) {
      debug('Error from cli/src/bin.ts')
      debug(e)
    }

    // check prisma for updates
    const checkResult = await checkpoint.check({
      product: 'prisma',
      cli_path_hash: cliPathHash,
      project_hash: projectPathHash,
      version: packageJson.version,
      schema_providers: schemaProvider ? [schemaProvider] : undefined,
      schema_preview_features: schemaPreviewFeatures,
      schema_generators_providers: schemaGeneratorsProviders,
      cli_path: process.argv[1],
      cli_install_type: isPrismaInstalledGlobally ? 'global' : 'local',
      command: commandArray.join(' '),
      information: args['--telemetry-information'] || process.env.PRISMA_TELEMETRY_INFORMATION,
    })
    // if the result is cached and we're outdated, show this prompt
    const shouldHide = process.env.PRISMA_HIDE_UPDATE_MESSAGE
    if (checkResult.status === 'ok' && checkResult.data.outdated && !shouldHide) {
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

function handleIndividualError(error): void {
  if (error.rustStack) {
    handlePanic(error, packageJson.version, enginesVersion, commandArray.join(' '))
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

path.join(__dirname, '../../engines/query-engine-darwin')
path.join(__dirname, '../../engines/introspection-engine-darwin')
path.join(__dirname, '../../engines/prisma-fmt-darwin')

path.join(__dirname, '../../engines/query-engine-debian-openssl-1.0.x')
path.join(__dirname, '../../engines/introspection-engine-debian-openssl-1.0.x')
path.join(__dirname, '../../engines/prisma-fmt-debian-openssl-1.0.x')

path.join(__dirname, '../../engines/query-engine-debian-openssl-1.1.x')
path.join(__dirname, '../../engines/introspection-engine-debian-openssl-1.1.x')
path.join(__dirname, '../../engines/prisma-fmt-debian-openssl-1.1.x')

path.join(__dirname, '../../engines/query-engine-rhel-openssl-1.0.x')
path.join(__dirname, '../../engines/introspection-engine-rhel-openssl-1.0.x')
path.join(__dirname, '../../engines/prisma-fmt-rhel-openssl-1.0.x')

path.join(__dirname, '../../engines/query-engine-rhel-openssl-1.1.x')
path.join(__dirname, '../../engines/introspection-engine-rhel-openssl-1.1.x')
path.join(__dirname, '../../engines/prisma-fmt-rhel-openssl-1.1.x')
