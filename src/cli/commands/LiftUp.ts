import { Command } from '../types'
import { arg, isError, format } from '../utils'
import { unknownCommand, HelpError } from '../Help'
import kleur from 'kleur'
import { Env } from '../Env'
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
      if (isNaN(maybeNumber)) {
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
      return new HelpError(
        `\n${kleur.bold().red(`!`)} ${error}\n${LiftUp.help}`,
      )
    }
    return LiftUp.help
  }

  // static help template
  private static help = format(`
    Migrate your database up to a specific state.

    ${kleur.bold('Usage')}

      prisma migrate up [<inc|name|timestamp>]

    ${kleur.bold('Arguments')}

      [<inc>]   go up by an increment [default: latest]

    ${kleur.bold('Options')}

      -p, --preview   Preview the migration changes

    ${kleur.bold('Examples')}

      Create a new migration and migrate up
      ${kleur.dim(`$`)} prisma migrate new --name "add unique to email"
      ${kleur.dim(`$`)} prisma migrate up

      Preview a migration without applying
      ${kleur.dim(`$`)} prisma migrate up --preview

      Go up by one migration
      ${kleur.dim(`$`)} prisma migrate up 1

      Go up by one migration
      ${kleur.dim(`$`)} prisma migrate up 1

      Go up by to a migration by name
      ${kleur.dim(`$`)} prisma migrate up
  `)
}
