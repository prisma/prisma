import { arg, Command, format, HelpError, isError } from '@prisma/sdk'
import chalk from 'chalk'
import { Migrate, UpOptions } from '../Migrate'
import { ensureDatabaseExists } from '../utils/ensureDatabaseExists'
import { ExperimentalFlagError } from '../utils/experimental'

export class MigrateUp implements Command {
  public static new(): MigrateUp {
    return new MigrateUp()
  }

  // static help template
  private static help = format(`
    Migrate your database up to a specific state.

    ${chalk.bold.yellow('WARNING')} ${chalk.bold(
    "Prisma's migration functionality is currently in an experimental state.",
  )}
    ${chalk.dim(
      'When using any of the commands below you need to explicitly opt-in via the --experimental flag.',
    )}

    ${chalk.bold('Usage')}

      ${chalk.dim('$')} prisma migrate up [<inc|name|timestamp>] --experimental

    ${chalk.bold('Arguments')}

      [<inc>]   go up by an increment [default: latest]

    ${chalk.bold('Options')}

      --auto-approve    Skip interactive approval before migrating
      -h, --help        Displays this help message
      -p, --preview     Preview the migration changes
      -c, --create-db   Create the database in case it doesn't exist

    ${chalk.bold('Examples')}

      Create a new migration, then migrate up
      ${chalk.dim(
        '$',
      )} prisma migrate save --name "add unique to email" --experimental
      ${chalk.dim('$')} prisma migrate up --experimental

      Preview a migration without migrating
      ${chalk.dim('$')} prisma migrate up --preview --experimental

      Go up by one migration
      ${chalk.dim('$')} prisma migrate up 1 --experimental

      Go up by to a migration by timestamp
      ${chalk.dim('$')} prisma migrate up 20190605204907 --experimental

      Go up by to a migration by name
      ${chalk.dim('$')} prisma migrate up "add first_name field" --experimental
  `)

  // parse arguments
  public async parse(argv: string[]): Promise<string | Error> {
    // parse the arguments according to the spec
    const args = arg(
      argv,
      {
        '--help': Boolean,
        '-h': '--help',
        '--preview': Boolean,
        '-p': '--preview',
        '--verbose': Boolean,
        '-v': '--verbose',
        '--create-db': Boolean,
        '-c': '--create-db',
        '--auto-approve': Boolean,
        '--experimental': Boolean,
        '--schema': String,
      },
      false,
    )

    if (isError(args)) {
      return this.help(args.message)
    }

    if (args['--help']) {
      return this.help()
    }

    if (!args['--experimental']) {
      throw new ExperimentalFlagError()
    }

    const migrate = new Migrate(args['--schema'])

    const options: UpOptions = {
      preview: args['--preview'],
      verbose: args['--verbose'],
      autoApprove: args['--auto-approve'],
    }

    if (args._.length > 0) {
      const thisArg = args._[0]
      const maybeNumber = parseInt(thisArg, 10)

      // in this case it's a migration id
      if (isNaN(maybeNumber) || typeof maybeNumber !== 'number') {
        throw new Error(`"${thisArg}" is not a valid migration step number`)
      } else {
        options.n = maybeNumber
      }
    }

    await ensureDatabaseExists(
      'apply',
      true,
      args['--create-db'],
      args['--schema'],
    )

    const result = await migrate.up(options)
    migrate.stop()
    return result
  }

  // help message
  public help(error?: string): string | HelpError {
    if (error) {
      return new HelpError(
        `\n${chalk.bold.red(`!`)} ${error}\n${MigrateUp.help}`,
      )
    }
    return MigrateUp.help
  }
}
