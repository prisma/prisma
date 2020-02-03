import { Command, arg, format, HelpError, getSchemaPath, isError } from '@prisma/cli'
import chalk from 'chalk'
import logUpdate from 'log-update'
import { missingGeneratorMessage } from '@prisma/sdk'
import { getGenerators } from '@prisma/sdk'
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
      ${chalk.dim('$')} prisma2 generate

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
      if (
        generator.manifest?.version &&
        generator.manifest?.version !== pkg.version &&
        generator.options?.generator.provider === 'prisma-client-js'
      ) {
        message.push(
          `${chalk.bold.yellowBright('⚠️')} ${chalk.bold(
            `@prisma/client@${generator.manifest?.version}`,
          )} is not compatible with ${chalk.bold(`prisma2@${pkg.version}`)}. Their versions need to be equal.`,
        )
      }
      message.push(`Generated ${chalk.bold(name!)}${toStr}`)
      const before = Date.now()
      await generator.generate()
      if (!watchMode) {
        generator.stop()
      }
      const after = Date.now()
      message.push(`Done in ${formatms(after - before)}\n`)
    }

    this.logText += message.join('\n')
  })

  // parse arguments
  public async parse(argv: string[], minimalOutput = false): Promise<string | Error> {
    // parse the arguments according to the spec
    const args = arg(argv, {
      '--help': Boolean,
      '-h': '--help',
      '--watch': Boolean,
    })

    if (isError(args)) {
      return this.help(args.message)
    }

    if (args['--help']) {
      return this.help()
    }

    const watchMode = args['--watch']

    const datamodelPath = await getSchemaPath()
    if (!datamodelPath) {
      throw new Error(`Can't find schema.prisma`) // TODO: Add this into a central place in getSchemaPath() as an arg
    }

    const generators = await getGenerators({
      schemaPath: datamodelPath,
      printDownloadProgress: !watchMode,
      version: pkg.prisma.version,
      cliVersion: pkg.version,
    })

    if (generators.length === 0) {
      console.error(missingGeneratorMessage)
    }

    const watchingText = `\n${chalk.green('Watching...')} ${chalk.dim(datamodelPath)}\n`

    if (watchMode) {
      logUpdate(watchingText)

      fs.watch(datamodelPath, async eventType => {
        if (eventType === 'change') {
          logUpdate(`\n${chalk.green('Building...')}\n\n${this.logText}`)
          await this.runGenerate({ generators, watchMode })
          logUpdate(watchingText + '\n' + this.logText)
        }
      })
    }

    await this.runGenerate({ generators, watchMode })
    watchMode ? logUpdate(watchingText + '\n' + this.logText) : logUpdate(this.logText)

    if (watchMode) await new Promise(r => null)

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
