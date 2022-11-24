import type { Command } from '@prisma/internals'
import { arg, format, formatms, formatSchema, getDMMF, HelpError } from '@prisma/internals'
import { getSchemaPathAndPrint } from '@prisma/migrate'
import chalk from 'chalk'
import fs from 'fs'
import os from 'os'

/**
 * $ prisma format
 */
export class Format implements Command {
  public static new(): Format {
    return new Format()
  }

  private static help = format(`
Format a Prisma schema.

${chalk.bold('Usage')}

  ${chalk.dim('$')} prisma format [options]

${chalk.bold('Options')}

  -h, --help   Display this help message
    --schema   Custom path to your Prisma schema

${chalk.bold('Examples')}

With an existing Prisma schema
  ${chalk.dim('$')} prisma format

Or specify a Prisma schema path
  ${chalk.dim('$')} prisma format --schema=./schema.prisma

  `)

  public async parse(argv: string[]): Promise<string | Error> {
    const before = Date.now()
    const args = arg(argv, {
      '--help': Boolean,
      '-h': '--help',
      '--schema': String,
      '--telemetry-information': String,
    })

    if (args instanceof Error) {
      return this.help(args.message)
    }

    if (args['--help']) {
      return this.help()
    }

    const schemaPath = await getSchemaPathAndPrint(args['--schema'])

    const output = await formatSchema({ schemaPath })

    try {
      // Validate whether the formatted output is a valid schema
      await getDMMF({
        datamodel: output,
      })
    } catch (e) {
      console.error('') // empty line for better readability
      throw new Error(`${e.message}`)
    }

    fs.writeFileSync(schemaPath, output)
    const after = Date.now()

    return `Formatted ${chalk.underline(schemaPath)} in ${formatms(after - before)} 🚀`
  }

  public help(error?: string): string | HelpError {
    if (error) {
      return new HelpError(`\n${chalk.bold.red(`!`)} ${error}\n${Format.help}`)
    }
    return Format.help
  }
}
