import {
  Command,
  arg,
  format,
  HelpError,
  getSchemaPath,
  isError,
} from '@prisma/sdk'
import chalk from 'chalk'
import logUpdate from 'log-update'
import {
  missingGeneratorMessage,
  getGenerators,
  highlightTS,
  link,
  Generator,
} from '@prisma/sdk'
import { formatms } from './utils/formatms'
import { simpleDebounce } from './utils/simpleDebounce'
import fs from 'fs'
import path from 'path'
const pkg = eval(`require('../package.json')`)

/**
 * $ prisma generate
 */
export class Generate implements Command {
  public static new(): Generate {
    return new Generate()
  }

  // static help template
  private static help = format(`
    Generate artifacts (e.g. Prisma Client)

    ${chalk.bold('Usage')}

    With an existing schema.prisma:
      ${chalk.dim('$')} prisma generate

    Or specify a schema:
      ${chalk.dim('$')} prisma generate --schema=./schema.prisma'

    ${chalk.bold('Flags')}

      --watch    Watches the Prisma project file
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
          message.push(
            `✔ Generated ${chalk.bold(name!)}${toStr} in ${formatms(
              after - before,
            )}\n`,
          )
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

  // parse arguments
  public async parse(argv: string[]): Promise<string | Error> {
    // parse the arguments according to the spec
    const args = arg(argv, {
      '--help': Boolean,
      '-h': '--help',
      '--watch': Boolean,
      '--schema': String,
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
If you have a Prisma Schema file in a custom path, you will need to run
\`prisma generate --schema=./path/to/your/schema.prisma\` to generate Prisma Client.
If you do not have a Prisma Schema file yet, you can ignore this message.`)
        return ''
      }
      throw new Error(
        `Either provide ${chalk.greenBright('--schema')} ${chalk.bold(
          'or',
        )} make sure that you are in a folder with a ${chalk.greenBright(
          'schema.prisma',
        )} file.`,
      )
    }

    let isJSClient
    let generators: Generator[] | undefined
    try {
      generators = await getGenerators({
        schemaPath,
        printDownloadProgress: !watchMode,
        version: pkg.prisma.version,
        cliVersion: pkg.version,
      })

      if (!generators || generators.length === 0) {
        this.logText += `${missingGeneratorMessage}\n`
      } else {
        // Only used for CLI output, ie Go client doesn't want JS example output
        isJSClient = generators.find(
          (g) =>
            g.options && g.options.generator.provider === 'prisma-client-js',
        )

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
Please run \`prisma generate\` to see the errors.`)
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
      const hint = `
You can now start using Prisma Client in your code:

\`\`\`
${highlightTS(`\
import { PrismaClient } from '@prisma/client'
// or const { PrismaClient } = require('@prisma/client')

const prisma = new PrismaClient()`)}
\`\`\`

Explore the full API: ${link('http://pris.ly/d/client')}`
      const message =
        '\n' +
        this.logText +
        (isJSClient && !this.hasGeneratorErrored ? hint : '')

      if (this.hasGeneratorErrored) {
        if (isPostinstall) {
          console.error(`${chalk.blueBright(
            'info',
          )} The postinstall script automatically ran \`prisma generate\`, which failed.
The postinstall script still succeeds but won't generate the Prisma Client.
Please run \`prisma generate\` to see the errors.`)
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
              version: pkg.prisma.version,
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
