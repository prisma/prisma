import { Command, arg, isError, format, Env, HelpError } from '@prisma/cli'
import chalk from 'chalk'
import { Lift, UpOptions } from '../../Lift'

export class LiftUp implements Command {
  static new(env: Env): LiftUp {
    return new LiftUp(env)
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

    const options: UpOptions = {
      preview: args['--preview'],
    }

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

    return lift.up(options)
  }

  // help message
  help(error?: string): string | HelpError {
    if (error) {
      return new HelpError(`\n${chalk.bold.red(`!`)} ${error}\n${LiftUp.help}`)
    }
    return LiftUp.help
  }

  // static help template
  private static help = format(`
    Migrate your database up to a specific state.

    ${chalk.bold('Usage')}

      prisma migrate up [<inc|name|timestamp>]

    ${chalk.bold('Arguments')}

      [<inc>]   go up by an increment [default: latest]

    ${chalk.bold('Options')}

      -p, --preview   Preview the migration changes

    ${chalk.bold('Examples')}

      Create a new migration and migrate up
      ${chalk.dim(`$`)} prisma migrate new --name "add unique to email"
      ${chalk.dim(`$`)} prisma migrate up

      Preview a migration without applying
      ${chalk.dim(`$`)} prisma migrate up --preview

      Go up by one migration
      ${chalk.dim(`$`)} prisma migrate up 1

      Go up by one migration
      ${chalk.dim(`$`)} prisma migrate up 1

      Go up by to a migration by name
      ${chalk.dim(`$`)} prisma migrate up
  `)
}
