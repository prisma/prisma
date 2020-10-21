import {
  arg,
  Command,
  Commands,
  format,
  HelpError,
  isError,
  unknownCommand,
} from '@prisma/sdk'
import chalk from 'chalk'

export class DbCommand implements Command {
  public static new(cmds: Commands): DbCommand {
    return new DbCommand(cmds)
  }

  // static help template
  private static help = format(`
    ${
      process.platform === 'win32' ? '' : chalk.bold('🏋️  ')
    }Powerful Prisma db commands from your terminal

    ${chalk.bold('Usage')}

      With an existing schema.prisma:
      ${chalk.dim('$')} prisma db [command] [options]

      Or specify a schema:
      ${chalk.dim('$')} prisma db [command] [options] --schema=./schema.prisma

    ${chalk.bold('Options')}

      -h, --help   Display this help message

    ${chalk.bold('Commands')}

        push   Push the state from your schema.prisma to your database
        drop   Delete the database provided in your schema.prisma

    ${chalk.bold('Examples')}

      Using prisma db push
      ${chalk.dim('$')} prisma db push

      Using prisma db drop
      ${chalk.dim('$')} prisma db drop
  `)
  private constructor(private readonly cmds: Commands) {}

  public async parse(argv: string[]): Promise<string | Error> {
    // parse the arguments according to the spec
    const args = arg(argv, {
      '--help': Boolean,
      '-h': '--help',
      '--telemetry-information': String,
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

    return unknownCommand(DbCommand.help, args._[0])
  }

  public help(error?: string): string | HelpError {
    if (error) {
      return new HelpError(
        `\n${chalk.bold.red(`!`)} ${error}\n${DbCommand.help}`,
      )
    }
    return DbCommand.help
  }
}
