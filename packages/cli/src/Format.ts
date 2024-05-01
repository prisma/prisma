import fs from 'node:fs/promises'

import { arg, Command, format, formatms, formatSchema, HelpError, validate } from '@prisma/internals'
import { getSchemaPathAndPrint } from '@prisma/migrate'
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
    const before = Math.round(performance.now())
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

    const { schemaPath, files: datamodel } = await getSchemaPathAndPrint(args['--schema'])

    const formattedDatamodel = await formatSchema({ schemaPath, schema: datamodel })

    // Validate whether the formatted output is a valid schema
    validate({
      datamodel: formattedDatamodel,
    })

    if (Array.isArray(formattedDatamodel)) {
      for (const [filename, data] of formattedDatamodel) {
        await fs.writeFile(filename, data)
      }
    } else {
      await fs.writeFile(schemaPath, formattedDatamodel)
    }

    const after = Math.round(performance.now())

    return `Formatted ${underline(schemaPath)} in ${formatms(after - before)} 🚀`
  }

  public help(error?: string): string | HelpError {
    if (error) {
      return new HelpError(`\n${bold(red(`!`))} ${error}\n${Format.help}`)
    }
    return Format.help
  }
}
