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

  private static help = format(`
Update the database schema with migrations

${chalk.bold.yellow('WARNING')} ${chalk.bold(
    "Prisma's migration functionality is currently in Early Access.",
  )}
${chalk.dim(
  'When using any of the commands below you need to explicitly opt-in via the --early-access-feature flag.',
)}
  
${chalk.bold('Usage')}

  ${chalk.dim('$')} prisma migrate [command] [options] --early-access-feature

${chalk.bold('Commands for development')}

         dev   Create a migration from changes in Prisma schema, apply it to the database
               generate artifacts (e.g. Prisma Client)
       reset   Reset your database and apply all migrations, all data will be lost

${chalk.bold('Commands for production/staging')}

      deploy   Apply pending migrations to the database 
      status   Check the status of your database migrations
     resolve   Resolve issues with database migrations, i.e. baseline, failed migration, hotfix

${chalk.bold('Options')}

  -h, --help   Display this help message
    --schema   Custom path to your Prisma schema

${chalk.bold('Examples')}

  Create a migration from changes in Prisma schema, apply it to the database, generate artifacts (e.g. Prisma Client)
  ${chalk.dim('$')} prisma migrate dev --early-access-feature

  Reset your database and apply all migrations
  ${chalk.dim('$')} prisma migrate reset --early-access-feature

  Apply pending migrations to the database in production/staging
  ${chalk.dim('$')} prisma migrate deploy --early-access-feature

  Check the status of migrations in the production/staging database
  ${chalk.dim('$')} prisma migrate status --early-access-feature

  Specify a schema
  ${chalk.dim(
    '$',
  )} prisma migrate status --schema=./schema.prisma --early-access-feature

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
