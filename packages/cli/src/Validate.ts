import type { Command } from '@prisma/sdk'
import { arg, format, getConfig, getDMMF, getSchemaPath, HelpError } from '@prisma/sdk'
import chalk from 'chalk'
import fs from 'fs'
import path from 'path'

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

    console.log(chalk.dim(`Prisma schema loaded from ${path.relative(process.cwd(), schemaPath)}`))

    const schema = fs.readFileSync(schemaPath, 'utf-8')

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
