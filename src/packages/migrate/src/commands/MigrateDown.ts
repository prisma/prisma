import { arg, Command, format, HelpError, isError } from '@prisma/sdk'
import chalk from 'chalk'
import { DownOptions, Migrate } from '../Migrate'
import { ensureDatabaseExists } from '../utils/ensureDatabaseExists'
import { ExperimentalFlagError } from '../utils/experimental'

export class MigrateDown implements Command {
  public static new(): MigrateDown {
    return new MigrateDown()
  }

  // static help template
  private static help = format(`
    Migrate your database down to a specific state.

    ${chalk.bold.yellow('WARNING')} ${chalk.bold(
    "Prisma's migration functionality is currently in an experimental state.",
  )}
    ${chalk.dim(
      'When using any of the commands below you need to explicitly opt-in via the --experimental flag.',
    )}

    ${chalk.bold('Usage')}

      ${chalk.dim(
        '$',
      )} prisma migrate down [<dec|name|timestamp>] --experimental

    ${chalk.bold('Arguments')}

      [<dec>]   go down by an amount [default: 1]

    ${chalk.bold('Options')}

      -h, --help       Displays this help message

    ${chalk.bold('Examples')}

      Rollback a migration
      ${chalk.dim('$')} prisma migrate down 1 --experimental

      Go down to a migration by timestamp
      ${chalk.dim('$')} prisma migrate down 20190605204907 --experimental

      Go down to a migration by name
      ${chalk.dim(
        '$',
      )} prisma migrate down "add first_name field" --experimental
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

    const options: DownOptions = {}

    // TODO add go down by name and timestamp
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

    await ensureDatabaseExists('unapply', true, undefined, args['--schema'])

    const result = await migrate.down(options)
    migrate.stop()
    return result
  }

  // help message
  public help(error?: string): string | HelpError {
    if (error) {
      return new HelpError(
        `\n${chalk.bold.red(`!`)} ${error}\n${MigrateDown.help}`,
      )
    }
    return MigrateDown.help
  }
}
