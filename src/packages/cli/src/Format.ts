import {
  arg,
  Command,
  format,
  formatSchema,
  getDMMF,
  getSchemaPath,
  HelpError,
} from '@prisma/sdk'
import chalk from 'chalk'
import fs from 'fs'
import os from 'os'
import path from 'path'
import { formatms } from './utils/formatms'

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

    const schemaPath = await getSchemaPath(args['--schema'])

    if (!schemaPath) {
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

    const schema = fs.readFileSync(schemaPath, 'utf-8')

    await getDMMF({
      datamodel: schema,
    })

    let output = await formatSchema({
      schemaPath,
    })

    output = output.trimEnd() + os.EOL

    fs.writeFileSync(schemaPath, output)
    const after = Date.now()

    return `Formatted ${chalk.underline(schemaPath)} in ${formatms(
      after - before,
    )} 🚀`
  }

  public help(error?: string): string | HelpError {
    if (error) {
      return new HelpError(`\n${chalk.bold.red(`!`)} ${error}\n${Format.help}`)
    }
    return Format.help
  }
}
