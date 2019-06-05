import { Command, arg, isError, format, Env, HelpError } from '@prisma/cli'
import chalk from 'chalk'
import { Lift, UpOptions, DownOptions } from '../../Lift'

export class LiftDown implements Command {
  static new(env: Env): LiftDown {
    return new LiftDown(env)
  }
  private constructor(private readonly env: Env) {}

  // parse arguments
  async parse(argv: string[]): Promise<string | Error> {
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

    if (args._.length > 0) {
      const arg = args._[0]
      const maybeNumber = parseInt(arg)

      // in this case it's a migration id
      if (isNaN(maybeNumber) || typeof maybeNumber !== 'number') {
        throw new Error(`Invalid migration step ${maybeNumber}`)
      } else {
        options.n = maybeNumber
      }
    }

    return lift.down(options)
  }

  // help message
  help(error?: string): string | HelpError {
    if (error) {
      return new HelpError(
        `\n${chalk.bold.red(`!`)} ${error}\n${LiftDown.help}`,
      )
    }
    return LiftDown.help
  }

  // static help template
  private static help = format(`
    Migrate your database up to a specific state.

    ${chalk.bold('Usage')}

      prisma lift down [<inc>]

    ${chalk.bold('Arguments')}

      [<inc>]   go down by an increment [default: latest]

    ${chalk.bold('Examples')}

      Go down by one migration
      ${chalk.dim(`$`)} prisma lift down

      Go down by one migration
      ${chalk.dim(`$`)} prisma lift down 1
  `)
}
