import type { PrismaConfigInternal } from '@prisma/config'
import { enginesVersion } from '@prisma/engines'
import type { SqlQueryOutput } from '@prisma/generator-helper'
import {
  arg,
  type Command,
  format,
  type Generator,
  getCommandWithExecutor,
  getConfig,
  getGenerators,
  getGeneratorSuccessMessage,
  type GetSchemaResult,
  getSchemaWithPath,
  getSchemaWithPathOptional,
  HelpError,
  isError,
  link,
  loadEnvFile,
  logger,
  missingGeneratorMessage,
  parseEnvValue,
  type SchemaPathFromConfig,
} from '@prisma/internals'
import { printSchemaLoadedMessage } from '@prisma/migrate'
import fs from 'node:fs'
import { blue, bold, dim, green, red, yellow } from 'kleur/colors'
import logUpdate from 'log-update'
import path from 'node:path'
import resolvePkg from 'resolve-pkg'

import { getHardcodedUrlWarning } from './generate/getHardcodedUrlWarning'
import { introspectSql, sqlDirPath } from './generate/introspectSql'
import { Watcher } from './generate/Watcher'
import { breakingChangesMessage } from './utils/breakingChanges'
import { getRandomPromotion, renderPromotion } from './utils/handlePromotions'
import { handleNpsSurvey } from './utils/nps/survey'
import { simpleDebounce } from './utils/simpleDebounce'

// Import package.json directly instead of using eval
import pkgJson from '../package.json'
const pkg = pkgJson

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
             --watch   Watch the Prisma schema and rerun after a change
         --generator   Generator to use (may be provided multiple times)
         --no-engine   Generate a client for use with Accelerate only
         --no-hints    Hides the hint messages but still outputs errors and warnings
   --allow-no-models   Allow generating a client without models
   --sql               Generate typed sql module

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
        message.push(`${getGeneratorSuccessMessage(generator, after - before)}\n`)
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
      '--allow-no-models': Boolean,
      '--sql': Boolean,
    })

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

    const { schemas, schemaPath } = schemaResult
    printSchemaLoadedMessage(schemaPath)
    const engineConfig = await getConfig({ datamodel: schemas, ignoreEnvVarErrors: true })

    // TODO Extract logic from here
    let hasJsClient = false
    let generators: Generator[] | undefined
    let clientGeneratorVersion: string | null = null
    let typedSql: SqlQueryOutput[] | undefined
    if (args['--sql']) {
      typedSql = await introspectSql(schemaPath)
    }
    try {
      generators = await getGenerators({
        schemaPath,
        printDownloadProgress: !watchMode,
        version: enginesVersion,
        cliVersion: pkg.version,
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
        allowNoModels: Boolean(args['--allow-no-models']),
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

          if (Number.parseInt(major) === 2 && Number.parseInt(minor) < 12) {
            printBreakingChangesMessage = true
          }
        }
      } catch (_e) {
        //
      }
    }

    if (postinstallCwd && printBreakingChangesMessage && logger.should.warn()) {
      // skipping generate
      return `There have been breaking changes in Prisma Client since you updated last time.
Please run \`prisma generate\` manually.`
    }

    const watchingText = `\n${green('Watching...')} ${dim(schemaPath)}\n`

    const hideHints = args['--no-hints'] ?? false

    if (!watchMode) {
      const prismaClientJSGenerator = generators?.find(
        ({ options }) =>
          options?.generator.provider && parseEnvValue(options?.generator.provider) === 'prisma-client-js',
      )

      let hint = ''
      if (prismaClientJSGenerator) {
        const generator = prismaClientJSGenerator.options?.generator
        const isDeno = generator?.previewFeatures.includes('deno') && !!globalThis.Deno
        if (isDeno && !generator?.isCustomOutput) {
          throw new Error(`Can't find output dir for generator ${bold(generator!.name)} with provider ${bold(
            generator!.provider.value!,
          )}.
When using Deno, you need to define \`output\` in the client generator section of your schema.prisma file.`)
        }

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
          hint = `${getHardcodedUrlWarning(engineConfig)}${breakingChangesStr}${versionsWarning}`
        } else {
          hint = `
Start by importing your Prisma Client (See: https://pris.ly/d/importing-client)

${renderPromotion(promotion)}
${getHardcodedUrlWarning(engineConfig)}${breakingChangesStr}${versionsWarning}`
        }
      }

      const message = `\n${this.logText}${hasJsClient && !this.hasGeneratorErrored ? hint : ''}`

      if (this.hasGeneratorErrored) {
        if (postinstallCwd) {
          logger.info(`The postinstall script automatically ran \`prisma generate\`, which failed.
The postinstall script still succeeds but won't generate the Prisma Client.
Please run \`${getCommandWithExecutor('prisma generate')}\` to see the errors.`)
          return ''
        }
        throw new Error(message)
      }
      if (!hideHints) {
        await this.surveyHandler()
      }

      return message
    }
    logUpdate(`${watchingText}\n${this.logText}`)

    const watcher = new Watcher(schemaPath)
    if (args['--sql']) {
      watcher.add(sqlDirPath(schemaPath))
    }

    for await (const changedPath of watcher) {
      logUpdate(`Change in ${path.relative(process.cwd(), changedPath)}`)
      let generatorsWatch: Generator[] | undefined
      try {
        if (args['--sql']) {
          typedSql = await introspectSql(schemaPath)
        }

        generatorsWatch = await getGenerators({
          schemaPath,
          printDownloadProgress: !watchMode,
          version: enginesVersion,
          cliVersion: pkg.version,
          generatorNames: args['--generator'],
          typedSql,
        })

        if (!generatorsWatch || generatorsWatch.length === 0) {
          this.logText += `${missingGeneratorMessage}\n`
        } else {
          logUpdate(`\n${green('Building...')}\n\n${this.logText}`)
          try {
            await this.runGenerate({
              generators: generatorsWatch,
            })
            logUpdate(`${watchingText}\n${this.logText}`)
          } catch (errRunGenerate) {
            this.logText += `${errRunGenerate.message}\n\n`
            logUpdate(`${watchingText}\n${this.logText}`)
          }
        }
      } catch (errGetGenerators) {
        this.logText += `${errGetGenerators.message}\n\n`
        logUpdate(`${watchingText}\n${this.logText}`)
      }
    }

    return ''
  }

  // help message
  public help(error?: string): string | HelpError {
    if (error) {
      return new HelpError(`\n${bold(red('!'))} ${error}\n${Generate.help}`)
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
  } catch (_e) {
    return null
  }

  return null
}

async function getSchemaForGenerate(
  schemaFromArgs: string | undefined,
  schemaFromConfig: SchemaPathFromConfig | undefined,
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
