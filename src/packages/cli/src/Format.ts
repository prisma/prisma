import {
  Command,
  format,
  HelpError,
  getSchemaPath,
  arg,
  formatSchema,
} from '@prisma/sdk'
import chalk from 'chalk'
import { getConfig, getDMMF } from '@prisma/sdk'
import fs from 'fs'
import { formatms } from './utils/formatms'

/**
 * $ prisma validate
 */
export class Format implements Command {
  public static new(): Format {
    return new Format()
  }

  // static help template
  private static help = format(`
    Format a Prisma schema.

    ${chalk.bold('Usage')}

    With an existing schema.prisma:
      ${chalk.dim('$')} prisma format

    Or specify a schema:
      ${chalk.dim('$')} prisma format --schema=./schema.prisma

  `)

  // parse arguments
  public async parse(argv: string[]): Promise<string | Error> {
    const before = Date.now()
    const args = arg(argv, {
      '--help': Boolean,
      '-h': '--help',
      '--schema': String,
    })

    if (args instanceof Error) {
      return this.help(args.message)
    }

    if (args['--help']) {
      return this.help()
    }

    const schemaPath = await getSchemaPath(args['--schema'])

    if (!schemaPath) {
      throw new Error(
        `Either provide ${chalk.greenBright(
          '--schema',
        )} or make sure that you are in a folder with a ${chalk.greenBright(
          'schema.prisma',
        )} file.`,
      )
    }

    const schema = fs.readFileSync(schemaPath, 'utf-8')

    await getDMMF({
      datamodel: schema,
    })

    const output = await formatSchema({
      schemaPath,
    })

    fs.writeFileSync(schemaPath, output)
    const after = Date.now()

    return `Formatted ${chalk.underline(schemaPath)} in ${formatms(
      after - before,
    )} 🚀`
  }

  // help message
  public help(error?: string): string | HelpError {
    if (error) {
      return new HelpError(`\n${chalk.bold.red(`!`)} ${error}\n${Format.help}`)
    }
    return Format.help
  }
}
