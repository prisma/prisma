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
  missingGeneratorMessage,
} from '@prisma/sdk'
import chalk from 'chalk'
import fs from 'fs'
import logUpdate from 'log-update'
import path from 'path'
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

    With an existing Prisma schema
      ${chalk.dim('$')} prisma generate

    Or specify a schema:
      ${chalk.dim('$')} prisma generate --schema=./schema.prisma'

    ${chalk.bold('Flag')}

      --watch    Watch the Prisma schema and rerun after a change
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
              generator.options!.generator.output!,
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
            `✔ Generated ${chalk.bold(name!)}${version ? ` (version: ${version})` : ''
            }${toStr} in ${formatms(after - before)}\n`,
          )
          const useMessage = await generator.getUseMessage()
          if (useMessage) {
            message.push(`${useMessage}\n`)
          } else if (generator.options?.generator.provider === 'prisma-client-js') {
            const importPath = generator.options?.generator?.isCustomOutput
              ? prefixRelativePathIfNecessary(
                path.relative(
                  process.cwd(),
                  generator.options?.generator.output!,
                ),
              )
              : '@prisma/client'

            const instruction = String(highlightTS(`
import { PrismaClient } from '${importPath}'
// or const { PrismaClient } = require('${importPath}')

const prisma = new PrismaClient()`))

            message.push(`You can now start using Prisma Client in your code:

\`\`\`
${instruction}
\`\`\`

Explore the full API: ${link('http://pris.ly/d/client')}\n`)
          }
          generator.stop()
        } catch (err) {
          this.hasGeneratorErrored = true
          message.push(`${err.message}\n\n`)
          generator.stop()
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

    if (isError(args)) {
      return this.help(args.message)
    }

    if (args['--help']) {
      return this.help()
    }

    const watchMode = args['--watch'] || false

    const schemaPath = await getSchemaPath(args['--schema'])
    if (!schemaPath) {
      if (isPostinstall) {
        console.error(`${chalk.yellow(
          'warning',
        )} The postinstall script automatically ran \`prisma generate\` and did not find your \`prisma/schema.prisma\`.
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

    console.log(
      chalk.dim(
        `Prisma schema loaded from ${path.relative(process.cwd(), schemaPath)}`,
      ),
    )

    let generators: Generator[] | undefined
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

    const watchingText = `\n${chalk.green('Watching...')} ${chalk.dim(
      schemaPath,
    )}\n`

    if (!watchMode) {
      const message = `\n${this.logText}`

      if (this.hasGeneratorErrored) {
        if (isPostinstall) {
          console.error(`${chalk.blueBright(
            'info',
          )} The postinstall script automatically ran \`prisma generate\`, which failed.
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