import {
  arg,
  Command,
  Commands,
  format,
  HelpError,
  isError,
  link,
  unknownCommand,
} from '@prisma/sdk'
import chalk from 'chalk'
import { ExperimentalFlagWithNewMigrateError } from '../utils/flagErrors'

export class MigrateCommand implements Command {
  public static new(cmds: Commands): MigrateCommand {
    return new MigrateCommand(cmds)
  }

  private static help = format(`
${
  process.platform === 'win32' ? '' : chalk.bold('🏋️  ')
}Migrate your database with confidence

${chalk.bold.yellow('WARNING')} ${chalk.bold(
    `Prisma's migration functionality is currently in Preview (${link(
      'https://pris.ly/d/preview',
    )}).`,
  )}
${chalk.dim(
  'When using any of the commands below you need to explicitly opt-in via the --preview-feature flag.',
)}
  
${chalk.bold('Usage')}

  ${chalk.dim('$')} prisma migrate [command] [options] --preview-feature

${chalk.bold('Commands for development')}

         dev   Create migrations from your Prisma schema, apply them to the database,
               generate artifacts (Prisma Client)
       reset   Reset your database and apply all migrations

${chalk.bold('Commands for staging/production')}

      deploy   Apply migrations to update the database schema
      status   Check the status of your database migrations
     resolve   Resolve issues with database migrations (baseline, failed migration, hotfix)

${chalk.bold('Options')}

  -h, --help   Display this help message
    --schema   Custom path to your Prisma schema

${chalk.bold('Examples')}

  Automatically create a migration and apply it if there is a schema change
  ${chalk.dim('$')} prisma migrate dev --preview-feature

  Reset your database
  ${chalk.dim('$')} prisma migrate reset --preview-feature

  Deploy the migrations to your database
  ${chalk.dim('$')} prisma migrate deploy --preview-feature

  Check the status of your database migrations
  ${chalk.dim('$')} prisma migrate status --preview-feature

  Specify a schema
  ${chalk.dim(
    '$',
  )} prisma migrate status --schema=./schema.prisma --preview-feature

`)

  private constructor(private readonly cmds: Commands) {}

  /* eslint-disable-next-line @typescript-eslint/require-await */
  public async parse(argv: string[]): Promise<string | Error> {
    const args = arg(argv, {
      '--help': Boolean,
      '-h': '--help',
      '--experimental': Boolean,
      '--preview-feature': Boolean,
      '--early-access-feature': Boolean,
      '--telemetry-information': String,
    })

    if (isError(args)) {
      return this.help(args.message)
    }

    // display help for help flag or no subcommand
    if (args._.length === 0 || args['--help']) {
      return this.help()
    }

    if (['up', 'save', 'down'].includes(args._[0])) {
      throw new Error(
        `The current command "${args._[0]}" doesn't exist in the new version of Prisma Migrate.
Read more about how to upgrade: https://pris.ly/d/migrate-upgrade`,
      )
    }

    if (args['--experimental']) {
      throw new ExperimentalFlagWithNewMigrateError()
    }

    // check if we have that subcommand
    const cmd = this.cmds[args._[0]]
    if (cmd) {
      const argsForCmd = args['--preview-feature']
        ? [...args._.slice(1), `--preview-feature`]
        : args._.slice(1)
      return cmd.parse(argsForCmd)
    }

    return unknownCommand(MigrateCommand.help, args._[0])
  }

  public help(error?: string): string | HelpError {
    if (error) {
      return new HelpError(
        `\n${chalk.bold.red(`!`)} ${error}\n${MigrateCommand.help}`,
      )
    }
    return MigrateCommand.help
  }
}
