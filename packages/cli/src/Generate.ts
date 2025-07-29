import { defaultRegistry } from '@prisma/client-generator-registry'
import type { PrismaConfigInternal } from '@prisma/config'
import { enginesVersion } from '@prisma/engines'
import { SqlQueryOutput } from '@prisma/generator'
import {
  arg,
  Command,
  format,
  Generator,
  getCommandWithExecutor,
  getGenerators,
  getGeneratorSuccessMessage,
  GetSchemaResult,
  getSchemaWithPath,
  getSchemaWithPathOptional,
  HelpError,
  inferDirectoryConfig,
  isError,
  link,
  loadEnvFile,
  logger,
  missingGeneratorMessage,
  parseEnvValue,
} from '@prisma/internals'
import fs from 'fs'
import { blue, bold, dim, green, red, yellow } from 'kleur/colors'
import logUpdate from 'log-update'
import path from 'path'
import resolvePkg from 'resolve-pkg'

import { processSchemaResult } from '../../internals/src/cli/schemaContext'
import { getHardcodedUrlWarning } from './generate/getHardcodedUrlWarning'
import { introspectSql, sqlDirPath } from './generate/introspectSql'
import { Watcher } from './generate/Watcher'
import { breakingChangesMessage } from './utils/breakingChanges'
import { getRandomPromotion, renderPromotion } from './utils/handlePromotions'
import { handleNpsSurvey } from './utils/nps/survey'
import { simpleDebounce } from './utils/simpleDebounce'

const pkg = eval(`require('../package.json')`)

/**
 * $ prisma generate
 */
export class Generate implements Command {
  surveyHandler: () => Promise<void>

  constructor(surveyHandler: () => Promise<void> = handleNpsSurvey) {
    this.surveyHandler = surveyHandler
  }

  public static new(): Generate {
    return new Generate()
  }

  private static help = format(`
Generate artifacts (e.g. Prisma Client)

${bold('Usage')}

  ${dim('$')} prisma generate [options]

${bold('Options')}
          -h, --help   Display this help message
            --config   Custom path to your Prisma config file
            --schema   Custom path to your Prisma schema
               --sql   Generate typed sql module
             --watch   Watch the Prisma schema and rerun after a change
         --generator   Generator to use (may be provided multiple times)
         --no-engine   Generate a client for use with Accelerate only
          --no-hints   Hides the hint messages but still outputs errors and warnings
   --allow-no-models   Allow generating a client without models (default)
    --require-models   Do not allow generating a client without models

${bold('Examples')}

  With an existing Prisma schema
    ${dim('$')} prisma generate

  Or specify a schema
    ${dim('$')} prisma generate --schema=./schema.prisma

  Run the command with multiple specific generators
    ${dim('$')} prisma generate --generator client1 --generator client2

  Watch Prisma schema file and rerun after each change
    ${dim('$')} prisma generate --watch

`)

  private logText = ''
  private hasGeneratorErrored = false

  private runGenerate = simpleDebounce(async ({ generators }: { generators: Generator[] }) => {
    const message: string[] = []

    for (const generator of generators) {
      const before = Math.round(performance.now())
      try {
        await generator.generate()
        const after = Math.round(performance.now())
        message.push(getGeneratorSuccessMessage(generator, after - before) + '\n')
        generator.stop()
      } catch (err) {
        this.hasGeneratorErrored = true
        generator.stop()
        message.push(`${err.message}\n\n`)
      }
    }

    this.logText += message.join('\n')
  })

  public async parse(argv: string[], config: PrismaConfigInternal): Promise<string | Error> {
    const args = arg(argv, {
      '--help': Boolean,
      '-h': '--help',
      '--watch': Boolean,
      '--schema': String,
      '--config': String,
      '--data-proxy': Boolean,
      '--accelerate': Boolean,
      '--no-engine': Boolean,
      '--no-hints': Boolean,
      '--generator': [String],
      // Only used for checkpoint information
      '--postinstall': String,
      '--telemetry-information': String,
      // TODO: no longer needed, remove in Prisma 7
      '--allow-no-models': Boolean,
      '--require-models': Boolean,
      '--sql': Boolean,
    })

    let allowNoModels = true

    if (args['--require-models']) {
      if (args['--allow-no-models']) {
        return Error('Cannot use --allow-no-models and --require-models together')
      }
      allowNoModels = false
    }

    const postinstallCwd = process.env.PRISMA_GENERATE_IN_POSTINSTALL
    let cwd = process.cwd()
    if (postinstallCwd && postinstallCwd !== 'true') {
      cwd = postinstallCwd
    }
    if (isError(args)) {
      return this.help(args.message)
    }

    if (args['--help']) {
      return this.help()
    }

    const watchMode = args['--watch'] || false

    await loadEnvFile({ schemaPath: args['--schema'], printMessage: true, config })

    const schemaResult = await getSchemaForGenerate(args['--schema'], config.schema, cwd, Boolean(postinstallCwd))
    const promotion = getRandomPromotion()

    if (!schemaResult) return ''

    // Using typed sql requires env vars to be set during generate to connect to the database. Regular generate doesn't need that.
    const schemaContext = await processSchemaResult({ schemaResult, ignoreEnvVarErrors: !args['--sql'] })
    const directoryConfig = inferDirectoryConfig(schemaContext, config)

    // TODO Extract logic from here
    let hasJsClient = false
    let generators: Generator[] | undefined
    let clientGeneratorVersion: string | null = null
    let typedSql: SqlQueryOutput[] | undefined
    if (args['--sql']) {
      typedSql = await introspectSql(directoryConfig, schemaContext)
    }
    try {
      generators = await getGenerators({
        schemaContext,
        printDownloadProgress: !watchMode,
        version: enginesVersion,
        generatorNames: args['--generator'],
        postinstall: Boolean(args['--postinstall']),
        typedSql,
        noEngine:
          Boolean(args['--no-engine']) ||
          Boolean(args['--data-proxy']) || // legacy, keep for backwards compatibility
          Boolean(args['--accelerate']) || // legacy, keep for backwards compatibility
          Boolean(process.env.PRISMA_GENERATE_DATAPROXY) || // legacy, keep for backwards compatibility
          Boolean(process.env.PRISMA_GENERATE_ACCELERATE) || // legacy, keep for backwards compatibility
          Boolean(process.env.PRISMA_GENERATE_NO_ENGINE),
        allowNoModels,
        registry: defaultRegistry.toInternal(),
      })

      if (!generators || generators.length === 0) {
        this.logText += `${missingGeneratorMessage}\n`
      } else {
        // Only used for CLI output, ie Go client doesn't want JS example output
        const jsClient = generators.find(
          (g) => g.options && parseEnvValue(g.options.generator.provider) === 'prisma-client-js',
        )

        clientGeneratorVersion = jsClient?.manifest?.version ?? null

        hasJsClient = Boolean(jsClient)

        try {
          await this.runGenerate({ generators })
        } catch (errRunGenerate) {
          this.logText += `${errRunGenerate.message}\n\n`
        }
      }
    } catch (errGetGenerators) {
      if (postinstallCwd) {
        console.error(`${blue('info')} The postinstall script automatically ran \`prisma generate\`, which failed.
The postinstall script still succeeds but won't generate the Prisma Client.
Please run \`${getCommandWithExecutor('prisma generate')}\` to see the errors.`)
        return ''
      }
      if (watchMode) {
        this.logText += `${errGetGenerators.message}\n\n`
      } else {
        throw errGetGenerators
      }
    }

    let printBreakingChangesMessage = false
    if (hasJsClient) {
      try {
        const clientVersionBeforeGenerate = getCurrentClientVersion()

        if (clientVersionBeforeGenerate && typeof clientVersionBeforeGenerate === 'string') {
          const [major, minor] = clientVersionBeforeGenerate.split('.')

          if (parseInt(major) == 2 && parseInt(minor) < 12) {
            printBreakingChangesMessage = true
          }
        }
      } catch (e) {
        //
      }
    }

    if (postinstallCwd && printBreakingChangesMessage && logger.should.warn()) {
      // skipping generate
      return `There have been breaking changes in Prisma Client since you updated last time.
Please run \`prisma generate\` manually.`
    }

    const watchingText = `\n${green('Watching...')} ${dim(schemaContext.schemaRootDir)}\n`

    const hideHints = args['--no-hints'] ?? false

    if (!watchMode) {
      const prismaClientJSGenerator = generators?.find(
        ({ options }) =>
          options?.generator.provider && parseEnvValue(options?.generator.provider) === 'prisma-client-js',
      )

      let hint = ''
      if (prismaClientJSGenerator) {
        const breakingChangesStr = printBreakingChangesMessage
          ? `

${breakingChangesMessage}`
          : ''

        const versionsOutOfSync = clientGeneratorVersion && pkg.version !== clientGeneratorVersion
        const versionsWarning =
          versionsOutOfSync && logger.should.warn()
            ? `\n\n${yellow(bold('warn'))} Versions of ${bold(`prisma@${pkg.version}`)} and ${bold(
                `@prisma/client@${clientGeneratorVersion}`,
              )} don't match.
This might lead to unexpected behavior.
Please make sure they have the same version.`
            : ''

        if (hideHints) {
          hint = `${getHardcodedUrlWarning(schemaContext.primaryDatasource)}${breakingChangesStr}${versionsWarning}`
        } else {
          hint = `
Start by importing your Prisma Client (See: https://pris.ly/d/importing-client)

${renderPromotion(promotion)}
${getHardcodedUrlWarning(schemaContext.primaryDatasource)}${breakingChangesStr}${versionsWarning}`
        }
      }

      const message = '\n' + this.logText + (hasJsClient && !this.hasGeneratorErrored ? hint : '')

      if (this.hasGeneratorErrored) {
        if (postinstallCwd) {
          logger.info(`The postinstall script automatically ran \`prisma generate\`, which failed.
The postinstall script still succeeds but won't generate the Prisma Client.
Please run \`${getCommandWithExecutor('prisma generate')}\` to see the errors.`)
          return ''
        }
        throw new Error(message)
      } else {
        if (!hideHints) {
          await this.surveyHandler()
        }

        return message
      }
    } else {
      logUpdate(watchingText + '\n' + this.logText)

      const watcher = new Watcher(schemaContext.schemaRootDir)
      if (args['--sql']) {
        watcher.add(sqlDirPath(schemaContext.schemaRootDir))
      }

      for await (const changedPath of watcher) {
        logUpdate(`Change in ${path.relative(process.cwd(), changedPath)}`)

        const schemaResult = await getSchemaForGenerate(args['--schema'], config.schema, cwd, Boolean(postinstallCwd))
        if (!schemaResult) return ''

        const schemaContext = await processSchemaResult({ schemaResult, ignoreEnvVarErrors: !args['--sql'] })
        const directoryConfig = inferDirectoryConfig(schemaContext, config)

        let generatorsWatch: Generator[] | undefined
        try {
          if (args['--sql']) {
            typedSql = await introspectSql(directoryConfig, schemaContext)
          }

          generatorsWatch = await getGenerators({
            schemaContext,
            printDownloadProgress: !watchMode,
            version: enginesVersion,
            generatorNames: args['--generator'],
            typedSql,
            registry: defaultRegistry.toInternal(),
          })

          if (!generatorsWatch || generatorsWatch.length === 0) {
            this.logText += `${missingGeneratorMessage}\n`
          } else {
            logUpdate(`\n${green('Building...')}\n\n${this.logText}`)
            try {
              await this.runGenerate({
                generators: generatorsWatch,
              })
              logUpdate(watchingText + '\n' + this.logText)
            } catch (errRunGenerate) {
              this.logText += `${errRunGenerate.message}\n\n`
              logUpdate(watchingText + '\n' + this.logText)
            }
          }
        } catch (errGetGenerators) {
          this.logText += `${errGetGenerators.message}\n\n`
          logUpdate(watchingText + '\n' + this.logText)
        }
      }
    }

    return ''
  }

  // help message
  public help(error?: string): string | HelpError {
    if (error) {
      return new HelpError(`\n${bold(red(`!`))} ${error}\n${Generate.help}`)
    }
    return Generate.help
  }
}

function getCurrentClientVersion(): string | null {
  try {
    let pkgPath = resolvePkg('.prisma/client', { cwd: process.cwd() })
    if (!pkgPath) {
      const potentialPkgPath = path.join(process.cwd(), 'node_modules/.prisma/client')
      if (fs.existsSync(potentialPkgPath)) {
        pkgPath = potentialPkgPath
      }
    }
    if (pkgPath) {
      const indexPath = path.join(pkgPath, 'index.js')
      if (fs.existsSync(indexPath)) {
        const program = require(indexPath)
        return program?.prismaVersion?.client ?? program?.Prisma?.prismaVersion?.client
      }
    }
  } catch (e) {
    return null
  }

  return null
}

async function getSchemaForGenerate(
  schemaFromArgs: string | undefined,
  schemaFromConfig: string | undefined,
  cwd: string,
  isPostinstall: boolean,
): Promise<GetSchemaResult | null> {
  if (isPostinstall) {
    const schema = await getSchemaWithPathOptional(schemaFromArgs, schemaFromConfig, { cwd })
    if (schema) {
      return schema
    }
    logger.warn(`We could not find your Prisma schema in the default locations (see: ${link(
      'https://pris.ly/d/prisma-schema-location',
    )}).
If you have a Prisma schema file in a custom path, you will need to run
\`prisma generate --schema=./path/to/your/schema.prisma\` to generate Prisma Client.
If you do not have a Prisma schema file yet, you can ignore this message.`)
    return null
  }

  return getSchemaWithPath(schemaFromArgs, schemaFromConfig, { cwd })
}
