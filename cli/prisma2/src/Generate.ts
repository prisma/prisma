import { Command, arg, format, HelpError, getSchemaPath, isError } from '@prisma/sdk'
import chalk from 'chalk'
import logUpdate from 'log-update'
import { missingGeneratorMessage, getGenerators, highlightTS, link } from '@prisma/sdk'
import { formatms } from './utils/formatms'
import { simpleDebounce } from './utils/simpleDebounce'
import fs from 'fs'
import path from 'path'
const pkg = eval(`require('../package.json')`)

/**
 * $ prisma2 generate
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
      ${chalk.dim('$')} prisma2 generate

    Or specify a schema:
      ${chalk.dim('$')} prisma2 generate --schema=./schema.prisma'

    ${chalk.bold('Flags')}

      --watch    Watches the Prisma project file
  `)

  private logText = ''

  private runGenerate = simpleDebounce(async ({ generators, watchMode }) => {
    const message: string[] = []

    for (const generator of generators) {
      const toStr = generator.options!.generator.output!
        ? chalk.dim(` to .${path.sep}${path.relative(process.cwd(), generator.options!.generator.output!)}`)
        : ''
      const name = generator.manifest ? generator.manifest.prettyName : generator.options!.generator.provider
      const before = Date.now()
      await generator.generate()
      generator.stop()
      const after = Date.now()
      message.push(`✔ Generated ${chalk.bold(name!)}${toStr} in ${formatms(after - before)}\n`)
    }

    this.logText += message.join('\n')
  })

  // parse arguments
  public async parse(argv: string[]): Promise<string | Error> {
    // parse the arguments according to the spec
    const args = arg(argv, {
      '--help': Boolean,
      '-h': '--help',
      '--watch': Boolean,
      '--schema': String,
    })

    if (isError(args)) {
      return this.help(args.message)
    }

    if (args['--help']) {
      return this.help()
    }

    const watchMode = args['--watch']

    const schemaPath = await getSchemaPath(args['--schema'])
    if (!schemaPath) {
      throw new Error(
        `Either provide ${chalk.greenBright(
          '--schema',
        )} or make sure that you are in a folder with a ${chalk.greenBright('schema.prisma')} file.`,
      )
    }

    const generators = await getGenerators({
      schemaPath,
      printDownloadProgress: !watchMode,
      version: pkg.prisma.version,
      cliVersion: pkg.version,
    })

    if (generators.length === 0) {
      console.error(missingGeneratorMessage)
    }

    const watchingText = `\n${chalk.green('Watching...')} ${chalk.dim(schemaPath)}\n`

    if (watchMode) {
      logUpdate(watchingText)

      fs.watch(schemaPath, async eventType => {
        if (eventType === 'change') {
          const generators = await getGenerators({
            schemaPath,
            printDownloadProgress: !watchMode,
            version: pkg.prisma.version,
            cliVersion: pkg.version,
          })

          if (generators.length === 0) {
            console.error(missingGeneratorMessage)
          }

          logUpdate(`\n${chalk.green('Building...')}\n\n${this.logText}`)
          await this.runGenerate({ generators, watchMode })
          logUpdate(watchingText + '\n' + this.logText)
        }
      })
    }

    await this.runGenerate({ generators, watchMode })

    if (watchMode) {
      logUpdate(watchingText + '\n' + this.logText)
      await new Promise(r => null)
    } else {
      logUpdate(
        this.logText +
          `
You can now start using Prisma Client in your code:

\`\`\`
${highlightTS(`\
import { PrismaClient } from '@prisma/client'
// or const { PrismaClient } = require('@prisma/client')

const prisma = new PrismaClient()`)}
\`\`\`      

Explore the full API: ${link('http://pris.ly/d/client')}`,
      )
    }

    return ''
  }

  // help message
  public help(error?: string): string | HelpError {
    if (error) {
      return new HelpError(`\n${chalk.bold.red(`!`)} ${error}\n${Generate.help}`)
    }
    return Generate.help
  }
}
