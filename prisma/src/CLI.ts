import chalk from 'chalk'
import { Command, Commands, arg, isError, format, HelpError, unknownCommand } from '@prisma/cli'
import { Version } from './Version'

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
      '--version': Boolean,
      '-v': '--version',
    })
    if (isError(args)) {
      return this.help(args.message)
    }
    if (args['--version']) {
      return Version.new().parse(argv)
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

      ${chalk.dim(`$`)} prisma2 [command]

    ${chalk.bold('Commands')}

          init   Setup Prisma for your app
          lift   Migrate your datamodel
       convert   Converts a datamodel 1 to datamodel 2
    introspect   Get the datamodel of your database
      generate   Generate Photon
          seed   Seed data into your database

    ${chalk.bold('Examples')}

      Initialize files for a new Prisma project
      ${chalk.dim(`$`)} prisma2 init

      Start developing and auto migrating your changes locally
      ${chalk.dim(`$`)} prisma2 dev

      Save your changes into a migration
      ${chalk.dim(`$`)} prisma2 lift save
  `)
}
