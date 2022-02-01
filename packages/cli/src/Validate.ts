import type { Command } from '@prisma/sdk'
import { loadEnvFile } from '@prisma/sdk'
import { arg, format, getConfig, getDMMF, HelpError } from '@prisma/sdk'
import chalk from 'chalk'
import fs from 'fs'
import { getSchemaPathAndPrint } from '@prisma/migrate'

/**
 * $ prisma validate
 */
export class Validate implements Command {
  public static new(): Validate {
    return new Validate()
  }

  private static help = format(`
Validate a Prisma schema.

${chalk.bold('Usage')}

  ${chalk.dim('$')} prisma validate [options]

${chalk.bold('Options')}

  -h, --help   Display this help message
    --schema   Custom path to your Prisma schema

${chalk.bold('Examples')}

  With an existing Prisma schema
    ${chalk.dim('$')} prisma validate

  Or specify a Prisma schema path
    ${chalk.dim('$')} prisma validate --schema=./schema.prisma

`)

  public async parse(argv: string[]): Promise<string | Error> {
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

    loadEnvFile(args['--schema'])

    const schemaPath = await getSchemaPathAndPrint(args['--schema'])

    const schema = fs.readFileSync(schemaPath, 'utf-8')

    // TODO is the order of getDMMF / getConfig important
    await getDMMF({
      datamodel: schema,
    })

    await getConfig({
      datamodel: schema,
    })

    return `The schema at ${chalk.underline(schemaPath)} is valid 🚀`
  }

  // help message
  public help(error?: string): string | HelpError {
    if (error) {
      return new HelpError(`\n${chalk.bold.red(`!`)} ${error}\n${Validate.help}`)
    }
    return Validate.help
  }
}
