import { arg, Command, format, formatms, formatSchema, HelpError, validate } from '@prisma/internals'
import { getSchemaPathAndPrint } from '@prisma/migrate'
import fs from 'fs'
import { bold, dim, red, underline } from 'kleur/colors'

/**
 * $ prisma format
 */
export class Format implements Command {
  public static new(): Format {
    return new Format()
  }

  private static help = format(`
Format a Prisma schema.

${bold('Usage')}

  ${dim('$')} prisma format [options]

${bold('Options')}

  -h, --help   Display this help message
    --schema   Custom path to your Prisma schema

${bold('Examples')}

With an existing Prisma schema
  ${dim('$')} prisma format

Or specify a Prisma schema path
  ${dim('$')} prisma format --schema=./schema.prisma

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

    // Validate whether the formatted output is a valid schema
    validate({
      datamodel: output,
    })

    fs.writeFileSync(schemaPath, output)
    const after = Date.now()

    return `Formatted ${underline(schemaPath)} in ${formatms(after - before)} 🚀`
  }

  public help(error?: string): string | HelpError {
    if (error) {
      return new HelpError(`\n${bold(red(`!`))} ${error}\n${Format.help}`)
    }
    return Format.help
  }
}
