import { enginesVersion } from '@prisma/engines'
import {
  arg,
  Command,
  drawBox,
  format,
  Generator,
  getCommandWithExecutor,
  getConfig,
  getGenerators,
  getGeneratorSuccessMessage,
  GetSchemaResult,
  getSchemaWithPath,
  getSchemaWithPathOptional,
  HelpError,
  highlightTS,
  isError,
  link,
  loadEnvFile,
  logger,
  missingGeneratorMessage,
  parseEnvValue,
} from '@prisma/internals'
import { printSchemaLoadedMessage } from '@prisma/migrate'
import fs from 'fs'
import { blue, bold, dim, green, red, yellow } from 'kleur/colors'
import logUpdate from 'log-update'
import os from 'os'
import path from 'path'
import resolvePkg from 'resolve-pkg'

import { getHardcodedUrlWarning } from './generate/getHardcodedUrlWarning'
import { breakingChangesMessage } from './utils/breakingChanges'
import { simpleDebounce } from './utils/simpleDebounce'

const pkg = eval(`require('../package.json')`)

/**
 * $ prisma generate
 */
export class Generate implements Command {
  public static new(): Generate {
    return new Generate()
  }

  private static help = format(`
Generate artifacts (e.g. Prisma Client)

${bold('Usage')}

  ${dim('$')} prisma generate [options]

${bold('Options')}
          -h, --help   Display this help message
            --schema   Custom path to your Prisma schema
             --watch   Watch the Prisma schema and rerun after a change
         --generator   Generator to use (may be provided multiple times)
         --no-engine   Generate a client for use with Accelerate only
         --no-hint     Hides the hint messages but still outputs errors and warnings
   --allow-no-models   Allow generating a client without models

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

  public async parse(argv: string[]): Promise<string | Error> {
    const args = arg(argv, {
      '--help': Boolean,
      '-h': '--help',
      '--watch': Boolean,
      '--schema': String,
      '--data-proxy': Boolean,
      '--accelerate': Boolean,
      '--no-engine': Boolean,
      '--no-hint': Boolean,
      '--generator': [String],
      // Only used for checkpoint information
      '--postinstall': String,
      '--telemetry-information': String,
      '--allow-no-models': Boolean,
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

    await loadEnvFile({ schemaPath: args['--schema'], printMessage: true })

    const schemaResult = await getSchemaForGenerate(args['--schema'], cwd, Boolean(postinstallCwd))

    if (!schemaResult) return ''

    const { schemas, schemaPath } = schemaResult
    printSchemaLoadedMessage(schemaPath)
    const config = await getConfig({ datamodel: schemas, ignoreEnvVarErrors: true })

    // TODO Extract logic from here
    let hasJsClient
    let generators: Generator[] | undefined
    let clientGeneratorVersion: string | null = null
    try {
      generators = await getGenerators({
        schemaPath,
        printDownloadProgress: !watchMode,
        version: enginesVersion,
        cliVersion: pkg.version,
        generatorNames: args['--generator'],
        postinstall: Boolean(args['--postinstall']),
        noEngine:
          Boolean(args['--no-engine']) ||
          Boolean(args['--data-proxy']) || // legacy, keep for backwards compatibility
          Boolean(args['--accelerate']) || // legacy, keep for backwards compatibility
          Boolean(process.env.PRISMA_GENERATE_DATAPROXY) || // legacy, keep for backwards compatibility
          Boolean(process.env.PRISMA_GENERATE_ACCELERATE) || // legacy, keep for backwards compatibility
          Boolean(process.env.PRISMA_GENERATE_NO_ENGINE),
        allowNoModels: Boolean(args['--allow-no-models']),
        noHints: Boolean(args['--no-hints']),
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

    const watchingText = `\n${green('Watching...')} ${dim(schemaPath)}\n`

    if (!watchMode) {
      const prismaClientJSGenerator = generators?.find(
        ({ options }) =>
          options?.generator.provider && parseEnvValue(options?.generator.provider) === 'prisma-client-js',
      )

      const hideHintsMode = args['--no-hint'] || false

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

        const importPath = prismaClientJSGenerator.options?.generator?.isCustomOutput
          ? prefixRelativePathIfNecessary(
              replacePathSeparatorsIfNecessary(
                path.relative(process.cwd(), parseEnvValue(prismaClientJSGenerator.options.generator.output!)),
              ),
            )
          : '@prisma/client'

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

        const tryAccelerateMessage = `Deploying your app to serverless or edge functions?
Try Prisma Accelerate for connection pooling and caching.
${link('https://pris.ly/cli/--accelerate')}`

        const boxedTryAccelerateMessage = drawBox({
          height: tryAccelerateMessage.split('\n').length,
          width: 0, // calculated automatically
          str: tryAccelerateMessage,
          horizontalPadding: 2,
        })

        hint = `
Start using Prisma Client in Node.js (See: ${link('https://pris.ly/d/client')})
${dim('```')}
${highlightTS(`\
import { PrismaClient } from '${importPath}'
const prisma = new PrismaClient()`)}
${dim('```')}
or start using Prisma Client at the edge (See: ${link('https://pris.ly/d/accelerate')})
${dim('```')}
${highlightTS(`\
import { PrismaClient } from '${importPath}/${isDeno ? 'deno/' : ''}edge${isDeno ? '.ts' : ''}'
const prisma = new PrismaClient()`)}
${dim('```')}

See other ways of importing Prisma Client: ${link('http://pris.ly/d/importing-client')}

${boxedTryAccelerateMessage}
${getHardcodedUrlWarning(config)}${breakingChangesStr}${versionsWarning}`

        if (generator?.previewFeatures.includes('driverAdapters')) {
          if (generator?.isCustomOutput && isDeno) {
            hint = `
${bold('Start using Prisma Client')}
${dim('```')}
${highlightTS(`\
import { PrismaClient } from '${importPath}/${isDeno ? 'deno/' : ''}edge${isDeno ? '.ts' : ''}'
const prisma = new PrismaClient()`)}
${dim('```')}

More information: https://pris.ly/d/client`
          } else {
            hint = `
${bold('Start using Prisma Client')}
${dim('```')}
${highlightTS(`\
import { PrismaClient } from '${importPath}'
const prisma = new PrismaClient()`)}
${dim('```')}

More information: https://pris.ly/d/client`
          }

          hint = `${hint}

${boxedTryAccelerateMessage}
${getHardcodedUrlWarning(config)}${breakingChangesStr}${versionsWarning}`
        }
        if (hideHintsMode) hint = `${getHardcodedUrlWarning(config)}${breakingChangesStr}${versionsWarning}`
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
        return message
      }
    } else {
      logUpdate(watchingText + '\n' + this.logText)

      fs.watch(schemaPath, async (eventType) => {
        if (eventType === 'change') {
          let generatorsWatch: Generator[] | undefined
          try {
            generatorsWatch = await getGenerators({
              schemaPath,
              printDownloadProgress: !watchMode,
              version: enginesVersion,
              cliVersion: pkg.version,
              generatorNames: args['--generator'],
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
            // logUpdate(watchingText + '\n' + this.logText)
          } catch (errGetGenerators) {
            this.logText += `${errGetGenerators.message}\n\n`
            logUpdate(watchingText + '\n' + this.logText)
          }
        }
      })
      await new Promise((_) => null)
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

function prefixRelativePathIfNecessary(relativePath: string): string {
  if (relativePath.startsWith('..')) {
    return relativePath
  }

  return `./${relativePath}`
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
    //
    return null
  }

  return null
}

function replacePathSeparatorsIfNecessary(path: string): string {
  const isWindows = os.platform() === 'win32'
  if (isWindows) {
    return path.replace(/\\/g, '/')
  }
  return path
}

async function getSchemaForGenerate(
  schemaFromArgs: string | undefined,
  cwd: string,
  isPostinstall: boolean,
): Promise<GetSchemaResult | null> {
  if (isPostinstall) {
    const schema = await getSchemaWithPathOptional(schemaFromArgs, { cwd })
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

  return getSchemaWithPath(schemaFromArgs, { cwd })
}
