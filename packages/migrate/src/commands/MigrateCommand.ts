import type { Command, Commands } from '@prisma/internals'
import { arg, format, HelpError, isError, unknownCommand } from '@prisma/internals'
import { bold, dim, red } from 'kleur/colors'

export class MigrateCommand implements Command {
  public static new(cmds: Commands): MigrateCommand {
    return new MigrateCommand(cmds)
  }

  private static help = format(`
Update the database schema with migrations
  
${bold('Usage')}

  ${dim('$')} prisma migrate [command] [options]

${bold('Commands for development')}

         dev   Create a migration from changes in Prisma schema, apply it to the database
               trigger generators (e.g. Prisma Client)
       reset   Reset your database and apply all migrations, all data will be lost

${bold('Commands for production/staging')}

      deploy   Apply pending migrations to the database 
      status   Check the status of your database migrations
     resolve   Resolve issues with database migrations, i.e. baseline, failed migration, hotfix

${bold('Command for any stage')}

        diff   Compare the database schema from two arbitrary sources

${bold('Options')}

  -h, --help   Display this help message
    --schema   Custom path to your Prisma schema

${bold('Examples')}

  Create a migration from changes in Prisma schema, apply it to the database, trigger generators (e.g. Prisma Client)
  ${dim('$')} prisma migrate dev

  Reset your database and apply all migrations
  ${dim('$')} prisma migrate reset

  Apply pending migrations to the database in production/staging
  ${dim('$')} prisma migrate deploy

  Check the status of migrations in the production/staging database
  ${dim('$')} prisma migrate status

  Specify a schema
  ${dim('$')} prisma migrate status --schema=./schema.prisma

  Compare the database schema from two databases and render the diff as a SQL script
  ${dim('$')} prisma migrate diff \\
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
      '--preview-feature': Boolean,
      '--telemetry-information': String,
    })

    if (isError(args)) {
      return this.help(args.message)
    }

    // display help for help flag or no subcommand
    if (args._.length === 0 || args['--help']) {
      return this.help()
    }

    const commandName = args._[0]

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
      return new HelpError(`\n${bold(red(`!`))} ${error}\n${MigrateCommand.help}`)
    }
    return MigrateCommand.help
  }
}
