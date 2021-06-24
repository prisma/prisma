/* eslint-disable eslint-comments/disable-enable-pair, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/restrict-template-expressions */
import { enginesVersion } from '@prisma/engines'
import {
  arg,
  Command,
  format,
  Generator,
  getCommandWithExecutor,
  getGenerators,
  getSchemaPath,
  HelpError,
  highlightTS,
  isError,
  link,
  logger,
  missingGeneratorMessage,
  parseEnvValue,
} from '@prisma/sdk'
import chalk from 'chalk'
import fs from 'fs'
import logUpdate from 'log-update'
import path from 'path'
import resolvePkg from 'resolve-pkg'
import { breakingChangesMessage } from './utils/breakingChanges'
import { formatms } from './utils/formatms'
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

${chalk.bold('Usage')}

  ${chalk.dim('$')} prisma generate [options]

${chalk.bold('Options')}

  -h, --help   Display this help message
    --schema   Custom path to your Prisma schema
     --watch   Watch the Prisma schema and rerun after a change

${chalk.bold('Examples')}

  With an existing Prisma schema
    ${chalk.dim('$')} prisma generate

  Or specify a schema
    ${chalk.dim('$')} prisma generate --schema=./schema.prisma

  Watch Prisma schema file and rerun after each change
    ${chalk.dim('$')} prisma generate --watch

`)

  private logText = ''
  private hasGeneratorErrored = false

  private runGenerate = simpleDebounce(
    async ({ generators }: { generators: Generator[] }) => {
      const message: string[] = []

      for (const generator of generators) {
        const toStr = generator.options!.generator.output!
          ? chalk.dim(
              ` to .${path.sep}${path.relative(
                process.cwd(),
                parseEnvValue(generator.options!.generator.output!),
              )}`,
            )
          : ''
        const name = generator.manifest
          ? generator.manifest.prettyName
          : generator.options!.generator.provider
        const before = Date.now()
        try {
          await generator.generate()
          const after = Date.now()
          const version = generator.manifest?.version
          message.push(
            `✔ Generated ${chalk.bold(name!)}${
              version ? ` (${version})` : ''
            }${toStr} in ${formatms(after - before)}\n`,
          )
          generator.stop()
        } catch (err) {
          this.hasGeneratorErrored = true
          generator.stop()
          // This is an error received when the the client < 2.20 and the cli  >= 2.20, This was caused by a breaking change in the generators
          if (err.message.includes('outputDir.endsWith is not a function')) {
            message.push(
              `This combination of Prisma CLI (>= 2.20) and Prisma Client (< 2.20) is not supported. Please update \`@prisma/client\` to ${pkg.version}   \n\n`,
            )
          } else {
            message.push(`${err.message}\n\n`)
          }
        }
      }

      this.logText += message.join('\n')
    },
  )

  public async parse(argv: string[]): Promise<string | Error> {
    const args = arg(argv, {
      '--help': Boolean,
      '-h': '--help',
      '--watch': Boolean,
      '--schema': String,
      // Only used for checkpoint information
      '--postinstall': String,
      '--telemetry-information': String,
    })

    const isPostinstall = process.env.PRISMA_GENERATE_IN_POSTINSTALL
    let cwd = process.cwd()
    if (isPostinstall && isPostinstall !== 'true') {
      cwd = isPostinstall
    }
    if (isError(args)) {
      return this.help(args.message)
    }

    if (args['--help']) {
      return this.help()
    }

    const watchMode = args['--watch'] || false

    const schemaPath = await getSchemaPath(args['--schema'], { cwd })
    if (!schemaPath) {
      if (isPostinstall) {
        logger.warn(`The postinstall script automatically ran \`prisma generate\` and did not find your \`prisma/schema.prisma\`.
If you have a Prisma schema file in a custom path, you will need to run
\`prisma generate --schema=./path/to/your/schema.prisma\` to generate Prisma Client.
If you do not have a Prisma schema file yet, you can ignore this message.`)
        return ''
      }
      throw new Error(
        `Could not find a ${chalk.bold(
          'schema.prisma',
        )} file that is required for this command.\nYou can either provide it with ${chalk.greenBright(
          '--schema',
        )}, set it as \`prisma.schema\` in your package.json or put it into the default location ${chalk.greenBright(
          './prisma/schema.prisma',
        )} https://pris.ly/d/prisma-schema-location`,
      )
    }

    logger.log(
      chalk.dim(
        `Prisma schema loaded from ${path.relative(process.cwd(), schemaPath)}`,
      ),
    )

    let hasJsClient
    let generators: Generator[] | undefined
    let clientGeneratorVersion: string | null = null
    try {
      generators = await getGenerators({
        schemaPath,
        printDownloadProgress: !watchMode,
        version: enginesVersion,
        cliVersion: pkg.version,
      })

      if (!generators || generators.length === 0) {
        this.logText += `${missingGeneratorMessage}\n`
      } else {
        // Only used for CLI output, ie Go client doesn't want JS example output
        const jsClient = generators.find(
          (g) =>
            g.options &&
            parseEnvValue(g.options.generator.provider) === 'prisma-client-js',
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
      if (isPostinstall) {
        console.error(`${chalk.blueBright(
          'info',
        )} The postinstall script automatically ran \`prisma generate\`, which failed.
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
        if (
          clientVersionBeforeGenerate &&
          typeof clientVersionBeforeGenerate === 'string'
        ) {
          const minor = clientVersionBeforeGenerate.split('.')[1]
          if (parseInt(minor, 10) < 12) {
            printBreakingChangesMessage = true
          }
        }
      } catch (e) {
        //
      }
    }

    if (isPostinstall && printBreakingChangesMessage && logger.should.warn) {
      // skipping generate
      return `There have been breaking changes in Prisma Client since you updated last time.
Please run \`prisma generate\` manually.`
    }

    const watchingText = `\n${chalk.green('Watching...')} ${chalk.dim(
      schemaPath,
    )}\n`

    if (!watchMode) {
      const prismaClientJSGenerator = generators?.find(
        (g) =>
          g.options?.generator.provider &&
          parseEnvValue(g.options?.generator.provider) === 'prisma-client-js',
      )
      let hint = ''
      if (prismaClientJSGenerator) {
        const importPath = prismaClientJSGenerator.options?.generator
          ?.isCustomOutput
          ? prefixRelativePathIfNecessary(
              path.relative(
                process.cwd(),
                parseEnvValue(
                  prismaClientJSGenerator.options.generator.output!,
                ),
              ),
            )
          : '@prisma/client'
        const breakingChangesStr = printBreakingChangesMessage
          ? `

${breakingChangesMessage}`
          : ''

        const versionsOutOfSync =
          clientGeneratorVersion && pkg.version !== clientGeneratorVersion
        const versionsWarning =
          versionsOutOfSync && logger.should.warn
            ? `\n\n${chalk.yellow.bold('warn')} Versions of ${chalk.bold(
                `prisma@${pkg.version}`,
              )} and ${chalk.bold(
                `@prisma/client@${clientGeneratorVersion}`,
              )} don't match.
This might lead to unexpected behavior.
Please make sure they have the same version.`
            : ''

        hint = `You can now start using Prisma Client in your code. Reference: ${link(
          'https://pris.ly/d/client',
        )}
${chalk.dim('```')}
${highlightTS(`\
import { PrismaClient } from '${importPath}'
const prisma = new PrismaClient()`)}
${chalk.dim('```')}${breakingChangesStr}${versionsWarning}`
      }
      const message =
        '\n' +
        this.logText +
        (hasJsClient && !this.hasGeneratorErrored ? hint : '')

      if (this.hasGeneratorErrored) {
        if (isPostinstall) {
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
            })

            if (!generatorsWatch || generatorsWatch.length === 0) {
              this.logText += `${missingGeneratorMessage}\n`
            } else {
              logUpdate(`\n${chalk.green('Building...')}\n\n${this.logText}`)
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
      await new Promise((_) => null) // eslint-disable-line @typescript-eslint/no-unused-vars
    }

    return ''
  }

  // help message
  public help(error?: string): string | HelpError {
    if (error) {
      return new HelpError(
        `\n${chalk.bold.red(`!`)} ${error}\n${Generate.help}`,
      )
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
      const potentialPkgPath = path.join(
        process.cwd(),
        'node_modules/.prisma/client',
      )
      if (fs.existsSync(potentialPkgPath)) {
        pkgPath = potentialPkgPath
      }
    }
    if (pkgPath) {
      const indexPath = path.join(pkgPath, 'index.js')
      if (fs.existsSync(indexPath)) {
        const program = require(indexPath)
        return (
          program?.prismaVersion?.client ??
          program?.Prisma?.prismaVersion?.client
        )
      }
    }
  } catch (e) {
    //
    return null
  }

  return null
}
