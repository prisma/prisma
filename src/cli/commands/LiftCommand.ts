import { Command, Commands } from '../types'
import { arg, isError, format } from '../utils'
import { unknownCommand, HelpError } from '../Help'
import kleur from 'kleur'
import { LiftWatch } from './LiftWatch'
import { Env } from '../Env'

/**
 * Migrate command
 */
export class LiftCommand implements Command {
  static new(cmds: Commands, env: Env): LiftCommand {
    return new LiftCommand(cmds, env)
  }
  private constructor(
    private readonly cmds: Commands,
    private readonly env: Env,
  ) {}

  async parse(argv: string[]): Promise<string | Error> {
    // parse the arguments according to the spec
    const args = arg(argv, {
      '--help': Boolean,
      '-h': '--help',
      '--watch': Boolean,
      '-w': '--watch',
      '--preview': Boolean,
      '-p': '--preview',
    })
    if (isError(args)) {
      return this.help(args.message)
    }
    // display help for help flag or no subcommand
    if (args._.length === 0 || args['--help']) {
      return this.help()
    }
    // check if we have that subcommand
    const cmd = this.cmds[args._[0]]
    if (cmd) {
      return cmd.parse(args._.slice(1))
    }

    if (args['--watch']) {
      return LiftWatch.new(this.env).parse(argv)
    }

    return unknownCommand(LiftCommand.help, args._[0])
  }

  help(error?: string): string | HelpError {
    if (error) {
      return new HelpError(
        `\n${kleur.bold().red(`!`)} ${error}\n${LiftCommand.help}`,
      )
    }
    return LiftCommand.help
  }

  // static help template
  private static help = format(`
    ${kleur.bold('🏋️‍')}  Lift - Migrate your database schema and data safely

    ${kleur.bold('Usage')}

      prisma lift [command] [options]

    ${kleur.bold('Options')}

      -n, --name      Name of the migration
      -p, --preview   Preview the migration changes
      -w, --watch     Watch for datamodel changes

    ${kleur.bold('Commands')}

      docs   Open documentation in the browser
      down   Migrate your database down
      help   Display command-specific help
    create   Setup a new migration
        up   Migrate your database up

    ${kleur.bold('Examples')}

      Migrate up to the latest datamodel
      ${kleur.dim(`$`)} prisma lift

      Create new migration folder
      ${kleur.dim(`$`)} prisma lift create

      Rollback a migration
      ${kleur.dim(`$`)} prisma lift down 1

      Preview the next migration without applying
      ${kleur.dim(`$`)} prisma lift up 1 --preview

      Watch for any changes to the datamodel
      ${kleur.dim(`$`)} prisma lift --watch
  `)
}
