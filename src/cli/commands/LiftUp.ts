import { Command } from '../types'
import { arg, isError, format } from '../utils'
import { unknownCommand, HelpError } from '../Help'
import kleur from 'kleur'
import { Env } from '../Env'
import { Lift } from '../../Lift'

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
    })
    if (isError(args)) {
      return this.help(args.message)
    } else if (args['--help']) {
      return this.help()
    }

    const lift = new Lift(this.env.cwd)

    return lift.up()
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

      [<inc|ts|name>]   go up by an increment or to a timestamp or name [default: latest]

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
