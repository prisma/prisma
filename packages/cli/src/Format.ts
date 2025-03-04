import fs from 'node:fs/promises'
import path from 'node:path'

import type { PrismaConfigInternal } from '@prisma/config'
import { arg, type Command, format, formatms, formatSchema, HelpError, validate } from '@prisma/internals'
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
    --config   Custom path to your Prisma config file
    --schema   Custom path to your Prisma schema

${bold('Examples')}

With an existing Prisma schema
  ${dim('$')} prisma format

Or specify a Prisma schema path
  ${dim('$')} prisma format --schema=./schema.prisma

  `)

  public async parse(argv: string[], config: PrismaConfigInternal): Promise<string | Error> {
    const before = Math.round(performance.now())
    const args = arg(argv, {
      '--help': Boolean,
      '-h': '--help',
      '--schema': String,
      '--config': String,
      '--telemetry-information': String,
      '--check': Boolean,
    })

    if (args instanceof Error) {
      return this.help(args.message)
    }

    if (args['--help']) {
      return this.help()
    }

    const { schemaPath, schemas } = await getSchemaPathAndPrint(args['--schema'], config.schema)

    const formattedDatamodel = await formatSchema({ schemas })

    // Validate whether the formatted output is a valid schema
    validate({
      schemas: formattedDatamodel,
    })

    if (args['--check']) {
      for (const [filename, formattedSchema] of formattedDatamodel) {
        const originalSchemaTuple = schemas.find((s) => s[0] === filename)
        if (!originalSchemaTuple) {
          return new HelpError(`${bold(red('!'))} The schema ${underline(filename)} is not found in the schema list.`)
        }
        const [, originalSchema] = originalSchemaTuple
        if (originalSchema !== formattedSchema) {
          return new HelpError(
            `${bold(red('!'))} There are unformatted files. Run ${underline('prisma format')} to format them.`,
          )
        }
      }
      return 'All files are formatted correctly!'
    }

    for (const [filename, data] of formattedDatamodel) {
      await fs.writeFile(filename, data)
    }

    const after = Math.round(performance.now())
    const schemaRelativePath = path.relative(process.cwd(), schemaPath)

    return `Formatted ${underline(schemaRelativePath)} in ${formatms(after - before)} 🚀`
  }

  public help(error?: string): string | HelpError {
    if (error) {
      return new HelpError(`\n${bold(red('!'))} ${error}\n${Format.help}`)
    }
    return Format.help
  }
}
