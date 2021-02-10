import {
  arg,
  Command,
  format,
  HelpError,
  isError,
  link,
  getSchemaPath,
} from '@prisma/sdk'
import path from 'path'
import chalk from 'chalk'
import { PreviewFlagError } from '../utils/flagErrors'
import { NoSchemaFoundError } from '../utils/errors'
import { tryToRunSeed } from '../utils/seed'

export class DbSeed implements Command {
  public static new(): DbSeed {
    return new DbSeed()
  }

  private static help = format(`
${process.platform === 'win32' ? '' : chalk.bold('🙌  ')}Seed your database

${chalk.bold.yellow('WARNING')} ${chalk.bold(
    `Prisma db seed is currently in Preview (${link(
      'https://pris.ly/d/preview',
    )}).
There may be bugs and it's not recommended to use it in production environments.`,
  )}
${chalk.dim(
  'When using any of the subcommands below you need to explicitly opt-in via the --preview-feature flag.',
)}

${chalk.bold('Usage')}

  ${chalk.dim('$')} prisma db seed [options] --preview-feature

${chalk.bold('Options')}

    -h, --help   Display this help message
      --schema   Custom path to your Prisma schema

${chalk.bold('Examples')}

  Specify a schema
  ${chalk.dim('$')} prisma db seed --preview-feature --schema=./schema.prisma
`)

  public async parse(argv: string[]): Promise<string | Error> {
    const args = arg(
      argv,
      {
        '--help': Boolean,
        '-h': '--help',
        '--preview-feature': Boolean,
        '--schema': String,
        '--telemetry-information': String,
      },
      false,
    )

    if (isError(args)) {
      return this.help(args.message)
    }

    if (args['--help']) {
      return this.help()
    }

    if (!args['--preview-feature']) {
      throw new PreviewFlagError()
    }

    const schemaPath = await getSchemaPath(args['--schema'])

    if (!schemaPath) {
      throw new NoSchemaFoundError()
    }

    console.log(
      chalk.dim(
        `Prisma schema loaded from ${path.relative(process.cwd(), schemaPath)}`,
      ),
    )

    await tryToRunSeed(schemaPath)

    return `\n${
      process.platform === 'win32' ? '' : '🌱  '
    }Your database has been seeded.`
  }

  public help(error?: string): string | HelpError {
    if (error) {
      return new HelpError(`\n${chalk.bold.red(`!`)} ${error}\n${DbSeed.help}`)
    }
    return DbSeed.help
  }
}
