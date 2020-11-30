import {
  arg,
  Command,
  Commands,
  format,
  HelpError,
  isError,
  unknownCommand,
} from '@prisma/sdk'
import chalk from 'chalk'
import { ExperimentalFlagWithNewMigrateError } from '../utils/flagErrors'

export class MigrateCommand implements Command {
  public static new(cmds: Commands): MigrateCommand {
    return new MigrateCommand(cmds)
  }

  private static help = format(`${
    process.platform === 'win32' ? '' : chalk.bold('🏋️  ')
  }Migrate your database with confidence

${chalk.bold.yellow('WARNING')} ${chalk.bold(
    "Prisma's migration functionality is currently in Early Access.",
  )}
${chalk.dim(
  'When using any of the commands below you need to explicitly opt-in via the --early-access-feature flag.',
)}
  
${chalk.bold('Usage')}

  ${chalk.dim('$')} prisma migrate [command] [options] --early-access-feature

${chalk.bold('Commands for development')}

         dev   Create migrations from your Prisma schema, apply them to the database,
               generate artifacts (Prisma Client)
       reset   Reset your database and apply all migrations

${chalk.bold('Commands for staging/production')}

      deploy   Apply migrations to update the database schema
     resolve   Resolve issues with database migrations (baseline, failed migration, hotfix)

${chalk.bold('Options')}

  -h, --help   Display this help message
    --schema   Custom path to your Prisma schema

${chalk.bold('Examples')}

  Specify a schema
  ${chalk.dim(
    '$',
  )} prisma migrate dev --schema=./schema.prisma --early-access-feature

  Automatically create a migration and apply it if there is a schema change
  ${chalk.dim('$')} prisma migrate dev --early-access-feature

  Reset your database
  ${chalk.dim('$')} prisma migrate reset --early-access-feature

  Deploy the migrations to your database
  ${chalk.dim('$')} prisma migrate deploy --early-access-feature

  Mark a migration as applied
  ${chalk.dim(
    '$',
  )} prisma migrate resolve --applied=20201231000000_add_users_table --early-access-feature
`)

  private constructor(private readonly cmds: Commands) {}

  /* eslint-disable-next-line @typescript-eslint/require-await */
  public async parse(argv: string[]): Promise<string | Error> {
    const args = arg(argv, {
      '--help': Boolean,
      '-h': '--help',
      '--experimental': Boolean,
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

    if (args['--experimental']) {
      throw new ExperimentalFlagWithNewMigrateError()
    }

    // check if we have that subcommand
    const cmd = this.cmds[args._[0]]
    if (cmd) {
      const argsForCmd = args['--early-access-feature']
        ? [...args._.slice(1), `--early-access-feature`]
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
