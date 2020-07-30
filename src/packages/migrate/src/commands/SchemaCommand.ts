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

export class SchemaCommand implements Command {
  public static new(cmds: Commands): SchemaCommand {
    return new SchemaCommand(cmds)
  }

  // static help template
  private static help = format(`
    ${
      process.platform === 'win32' ? '' : chalk.bold('🏋️  ')
    }Powerful Prisma schema commands from your terminal

    ${chalk.bold.yellow('WARNING')} ${chalk.bold(
    'This functionality is currently in an experimental state.',
  )}
    ${chalk.dim(
      'When using any of the commands below you need to explicitly opt-in via the --experimental flag.',
    )}

    ${chalk.bold('Usage')}

      With an existing schema.prisma:
      ${chalk.dim('$')} prisma schema [command] [options] --experimental

      Or specify a schema:
      ${chalk.dim(
        '$',
      )} prisma schema [command] [options] --experimental --schema=./schema.prisma

    ${chalk.bold('Options')}

      -h, --help   Display this help message

    ${chalk.bold('Commands')}

        push   Push the state from your schema.prisma to your database

    ${chalk.bold('Examples')}

      Using prisma schema push
      ${chalk.dim('$')} prisma schema push --experimental
  `)
  private constructor(private readonly cmds: Commands) {}

  public async parse(argv: string[]): Promise<string | Error> {
    // parse the arguments according to the spec
    const args = arg(argv, {
      '--help': Boolean,
      '-h': '--help',
      '--experimental': Boolean,
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
      const argsForCmd = args['--experimental']
        ? [...args._.slice(1), `--experimental=${args['--experimental']}`]
        : args._.slice(1)
      return cmd.parse(argsForCmd)
    }

    return unknownCommand(SchemaCommand.help, args._[0])
  }

  public help(error?: string): string | HelpError {
    if (error) {
      return new HelpError(
        `\n${chalk.bold.red(`!`)} ${error}\n${SchemaCommand.help}`,
      )
    }
    return SchemaCommand.help
  }
}
