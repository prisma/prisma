import { Command, Commands } from '../types'
import { arg, isError, format } from '../utils'
import { unknownCommand, HelpError } from '../Help'
import chalk from 'chalk'
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
        `\n${chalk.bold.red(`!`)} ${error}\n${LiftCommand.help}`,
      )
    }
    return LiftCommand.help
  }

  // static help template
  private static help = format(`
    ${chalk.bold('🏋️‍')}  Lift - Migrate your database schema and data safely

    ${chalk.bold('Usage')}

      prisma lift [command] [options]

    ${chalk.bold('Options')}

      -n, --name      Name of the migration
      -p, --preview   Preview the migration changes
      -w, --watch     Watch for datamodel changes

    ${chalk.bold('Commands')}

      docs   Open documentation in the browser
      down   Migrate your database down
      help   Display command-specific help
    create   Setup a new migration
        up   Migrate your database up

    ${chalk.bold('Examples')}

      Migrate up to the latest datamodel
      ${chalk.dim(`$`)} prisma lift

      Create new migration folder
      ${chalk.dim(`$`)} prisma lift create

      Rollback a migration
      ${chalk.dim(`$`)} prisma lift down 1

      Preview the next migration without applying
      ${chalk.dim(`$`)} prisma lift up 1 --preview

      Watch for any changes to the datamodel
      ${chalk.dim(`$`)} prisma lift --watch
  `)
}
