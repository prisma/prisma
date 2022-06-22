import type { Command, Commands } from '@prisma/internals'
import { arg, format, HelpError, isError, link, logger, unknownCommand } from '@prisma/internals'
import chalk from 'chalk'

import { ExperimentalFlagWithMigrateError } from '../utils/flagErrors'

export class MigrateCommand implements Command {
  public static new(cmds: Commands): MigrateCommand {
    return new MigrateCommand(cmds)
  }

  private static help = format(`
Update the database schema with migrations
  
${chalk.bold('Usage')}

  ${chalk.dim('$')} prisma migrate [command] [options]

${chalk.bold('Commands for development')}

         dev   Create a migration from changes in Prisma schema, apply it to the database
               trigger generators (e.g. Prisma Client)
       reset   Reset your database and apply all migrations, all data will be lost

${chalk.bold('Commands for production/staging')}

      deploy   Apply pending migrations to the database 
      status   Check the status of your database migrations
     resolve   Resolve issues with database migrations, i.e. baseline, failed migration, hotfix

${chalk.bold('Command for any stage')}

        diff   Compare the database schema from two arbitrary sources

${chalk.bold('Options')}

  -h, --help   Display this help message
    --schema   Custom path to your Prisma schema

${chalk.bold('Examples')}

  Create a migration from changes in Prisma schema, apply it to the database, trigger generators (e.g. Prisma Client)
  ${chalk.dim('$')} prisma migrate dev

  Reset your database and apply all migrations
  ${chalk.dim('$')} prisma migrate reset

  Apply pending migrations to the database in production/staging
  ${chalk.dim('$')} prisma migrate deploy

  Check the status of migrations in the production/staging database
  ${chalk.dim('$')} prisma migrate status

  Specify a schema
  ${chalk.dim('$')} prisma migrate status --schema=./schema.prisma

  Compare the database schema from two databases and render the diff as a SQL script
  ${chalk.dim('$')} prisma migrate diff \\
    --from-url "$DATABASE_URL" \\
    --to-url "postgresql://login:password@localhost:5432/db" \\
    --script
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

    if (args['--experimental']) {
      throw new ExperimentalFlagWithMigrateError()
    }

    // display help for help flag or no subcommand
    if (args._.length === 0 || args['--help']) {
      return this.help()
    }

    const commandName = args._[0]

    if (['up', 'save', 'down'].includes(commandName)) {
      throw new Error(
        `The current command "${args._[0]}" doesn't exist in the new version of Prisma Migrate.
Read more about how to upgrade: ${link('https://pris.ly/d/migrate-upgrade')}`,
      )
    }

    // Legacy warning only if --preview-feature is place before the command like below
    // prisma migrate --preview-feature command
    if (args['--preview-feature']) {
      logger.warn(`Prisma Migrate was in Preview and is now Generally Available.
You can now remove the ${chalk.red('--preview-feature')} flag.`)
    }

    // check if we have that subcommand
    const cmd = this.cmds[commandName]
    if (cmd) {
      let argsForCmd: string[]
      if (commandName === 'diff') {
        argsForCmd = args['--preview-feature'] ? [...args._.slice(1), `--preview-feature`] : args._.slice(1)
      } else {
        // Filter our --preview-feature flag for other migrate commands that do not consider it valid
        const filteredArgs = args._.filter((item) => item !== '--preview-feature')
        argsForCmd = filteredArgs.slice(1)
      }

      return cmd.parse(argsForCmd)
    }

    return unknownCommand(MigrateCommand.help, commandName)
  }

  public help(error?: string): string | HelpError {
    if (error) {
      return new HelpError(`\n${chalk.bold.red(`!`)} ${error}\n${MigrateCommand.help}`)
    }
    return MigrateCommand.help
  }
}
