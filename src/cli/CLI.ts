import chalk from 'chalk'
import { Command, Commands } from './types'
import { arg, isError, format } from './utils'
import { HelpError, unknownCommand } from './Help'

/**
 * CLI command
 */
export class CLI implements Command {
  static new(cmds: Commands): CLI {
    return new CLI(cmds)
  }
  private constructor(private readonly cmds: Commands) {}

  async parse(argv: string[]): Promise<string | Error> {
    // parse the args according to the following spec
    const args = arg(argv, {
      '--help': Boolean,
      '-h': '--help',
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
    // unknown command
    return unknownCommand(CLI.help, args._[0])
  }

  // help function
  private help(error?: string): string | HelpError {
    if (error) {
      return new HelpError(`\n${chalk.bold.red(`!`)} ${error}\n${CLI.help}`)
    }
    return CLI.help
  }

  // static help template
  private static help = format(`
    ${chalk.bold.green('◭')} Prisma makes your data easy (https://prisma.io)

    ${chalk.bold('Usage')}

      ${chalk.dim(`$`)} prisma [command]

    ${chalk.bold('Commands')}

          lift   Migrate your datamodel
           new   Setup Prisma for your app
          seed   Seed data into your database

    ${chalk.bold('Examples')}

      Initialize files for a new Prisma service
      ${chalk.dim(`$`)} prisma new

      Deploy service changes (or new service)
      ${chalk.dim(`$`)} prisma lift
  `)
}
