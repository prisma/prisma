import { arg, Command, Env, format, HelpError, isError } from '@prisma/cli'
import chalk from 'chalk'
import { DownOptions, Lift } from '../../Lift'
import { ensureDatabaseExists } from '../../utils/ensureDatabaseExists'

export class LiftDown implements Command {
  public static new(env: Env): LiftDown {
    return new LiftDown(env)
  }

  // static help template
  private static help = format(`
    Migrate your database down to a specific state.

    ${chalk.bold('Usage')}

      prisma lift down [<dec|name|timestamp>]

    ${chalk.bold('Arguments')}

      [<dec>]   go down by an amount [default: 1]

    ${chalk.bold('Options')}

      --auto-approve   Skip interactive approval before migrating
      -h, --help       Displays this help message
      -p, --preview    Preview the migration changes

    ${chalk.bold('Examples')}

      Preview a migration without migrating
      ${chalk.dim(`$`)} prisma migrate down --preview

      Rollback a migration
      ${chalk.dim(`$`)} prisma migrate down 1

      Go down to a migration by timestamp
      ${chalk.dim(`$`)} prisma migrate down 20190605204907

      Go down to a migration by name
      ${chalk.dim(`$`)} prisma migrate down "add first_name field"
  `)
  private constructor(private readonly env: Env) {}

  // parse arguments
  public async parse(argv: string[]): Promise<string | Error> {
    // parse the arguments according to the spec
    const args = arg(argv, {
      '--help': Boolean,
      '-h': '--help',
      '--preview': Boolean,
      '-p': '--preview',
    })

    if (isError(args)) {
      return this.help(args.message)
    } else if (args['--help']) {
      return this.help()
    }

    const lift = new Lift(this.env.cwd)

    const options: DownOptions = {}

    // TODO add go down by name and timestamp
    if (args._.length > 0) {
      const thisArg = args._[0]
      const maybeNumber = parseInt(thisArg, 10)

      // in this case it's a migration id
      if (isNaN(maybeNumber) || typeof maybeNumber !== 'number') {
        throw new Error(`Invalid migration step ${maybeNumber}`)
      } else {
        options.n = maybeNumber
      }
    }

    await ensureDatabaseExists('unapply')

    const result = await lift.down(options)
    lift.stop()
    return result
  }

  // help message
  public help(error?: string): string | HelpError {
    if (error) {
      return new HelpError(`\n${chalk.bold.red(`!`)} ${error}\n${LiftDown.help}`)
    }
    return LiftDown.help
  }
}
