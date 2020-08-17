#!/usr/bin/env ts-node
import fs from 'fs'
import path from 'path'
import dotenv from 'dotenv'
import chalk from 'chalk'

import {
  arg,
  drawBox,
  getCLIPathHash,
  getProjectHash,
  getSchema,
  getConfig,
} from '@prisma/sdk'
const packageJson = require('../package.json') // eslint-disable-line @typescript-eslint/no-var-requires

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

// If running via `ts-node`, treat NODE_ENV as development
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
// if the CLI is called witout any comand like `prisma` we can ignore .env loading
if (process.argv.length > 2) {
  let dotenvResult
  let message

  // 1 -Check --schema directory
  if (args && args['--schema']) {
    const dotenvFilepath = path.join(path.dirname(args['--schema']), '.env')

    if (fs.existsSync(args['--schema']) && fs.existsSync(dotenvFilepath)) {
      dotenvResult = dotenv.config({ path: dotenvFilepath })
      message = chalk.dim(
        'Environment variables loaded from provided --schema directory',
      )
    } else {
      debug('Environment variables not loaded (--schema was provided)')
    }
  }
  // 2 - Check ./prisma directory for schema.prisma
  else if (
    fs.existsSync('prisma/schema.prisma') &&
    fs.existsSync('prisma/.env')
  ) {
    dotenvResult = dotenv.config({ path: 'prisma/.env' })
    // needed for Windows
    const relative = path.relative('.', './prisma/.env')
    message = chalk.dim(`Environment variables loaded from ${relative}`)
  }
  // 3 - Check current directory for schema.prisma
  else if (fs.existsSync('schema.prisma') && fs.existsSync('.env')) {
    dotenvResult = dotenv.config()
    message = chalk.dim('Environment variables loaded from current directory')
  }
  // 4 - Check if ./prisma/.env exist and load it (we could not find a schema.prisma)
  else if (fs.existsSync('prisma/.env')) {
    dotenvResult = dotenv.config({ path: 'prisma/.env' })
    // needed for Windows
    const relative = path.relative('.', './prisma/.env')
    message = chalk.dim(`Environment variables loaded from ${relative}`)
  }
  // 5 - We didn't find a .env file next to the prisma.schema file.
  else {
    debug('Environment variables not loaded')
  }
  // Print the error if any (if internal dotenv readFileSync throws)
  if (dotenvResult && dotenvResult.error) {
    message = chalk.redBright.bold('Error: ') + dotenvResult.error
  }

  if (message && !process.env.PRISMA_GENERATE_IN_POSTINSTALL) {
    console.error(message)
  }
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
  handlePanic,
} from '@prisma/migrate'
import { isInstalledGlobally } from './utils/isInstalledGlobally'
import { CLI } from './CLI'
import { Introspect, Init } from '@prisma/introspection'
import { Dev } from './Dev'
import { Version } from './Version'
import { Generate } from './Generate'
import { ProviderAliases } from '@prisma/sdk'
import { Validate } from './Validate'
import { Format } from './Format'
import { Doctor } from './Doctor'
import { Studio } from './Studio'
import { Telemetry } from './Telemetry'

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

const isPrismaInstalledGlobally = isInstalledGlobally()

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
      'tmp-prepare',
      'introspect',
      'dev',
      'studio',
      'generate',
      'validate',
      'format',
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
    } catch (e) {
      //
      debug(e)
    }

    function makeInstallCommand(packageName: string, tag: string): string {
      // Examples
      // yarn 'yarn/1.22.4 npm/? node/v12.14.1 darwin x64'
      // npm 'npm/6.14.7 node/v12.14.1 darwin x64'
      const yarnUsed = process.env.npm_config_user_agent?.includes('yarn')

      let command = ''
      if (isPrismaInstalledGlobally === 'yarn') {
        command = `yarn global add ${packageName}`
      } else if (isPrismaInstalledGlobally === 'npm') {
        command = `npm i -g ${packageName}`
      } else if (yarnUsed) {
        command = `yarn add --dev ${packageName}`
      } else {
        command = `npm i --save-dev ${packageName}`
      }

      if (tag && tag !== 'latest') {
        command += `@${tag}`
      }

      return command
    }

    // check prisma for updates
    const checkResult = await checkpoint.check({
      product: 'prisma',
      cli_path_hash: cliPathHash,
      project_hash: projectPathHash,
      version: packageJson.version,
      schema_providers: schemaProviders,
      schema_preview_features: schemaPreviewFeatures,
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
      console.error(
        drawBox({
          height: 4,
          width: 59,
          str: `\n${chalk.blue('Update available')} ${
            checkResult.data.previous_version
          } -> ${checkResult.data.current_version}\nRun ${chalk.bold(
            makeInstallCommand(
              checkResult.data.package,
              checkResult.data.release_tag,
            ),
          )} to update`,
          horizontalPadding: 2,
        }),
      )
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
