import {
  arg,
  Command,
  Commands,
  format,
  HelpError,
  isError,
  unknownCommand,
  link,
} from '@prisma/sdk'
import chalk from 'chalk'

export class DbCommand implements Command {
  public static new(cmds: Commands): DbCommand {
    return new DbCommand(cmds)
  }

  private static help = format(`
${
  process.platform === 'win32' ? '' : chalk.bold('🏋️  ')
}Manage your database schema and lifecycle during development.

${chalk.bold.yellow('WARNING')} ${chalk.bold(
    `Prisma db is currently in Preview (${link('https://pris.ly/d/preview')}).
There may be bugs and it's not recommended to use it in production environments.`,
  )}
${chalk.dim(
  'When using any of the subcommands below you need to explicitly opt-in via the --preview-feature flag.',
)}

${chalk.bold('Flag')}

  --preview-feature   Run preview Prisma commands

${chalk.bold('Usage')}

  With an existing schema.prisma:
  ${chalk.dim('$')} prisma db [command] [options] --preview-feature

  Or specify a schema path:
  ${chalk.dim(
    '$',
  )} prisma db [command] [options] --preview-feature --schema=./schema.prisma

${chalk.bold('Options')}

  -h, --help   Display this help message

${chalk.bold('Commands')}

        push   Push the state from Prisma schema to the database during prototyping ${chalk.dim(
          '(preview)',
        )}

${chalk.bold('Examples')}

  Using prisma db push
  ${chalk.dim('$')} prisma db push --preview-feature
  `)
  private constructor(private readonly cmds: Commands) {}

  public async parse(argv: string[]): Promise<string | Error> {
    const args = arg(argv, {
      '--help': Boolean,
      '-h': '--help',
      '--preview-feature': Boolean,
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
      const argsForCmd = args['--preview-feature']
        ? [...args._.slice(1), `--preview-feature`]
        : args._.slice(1)
      return cmd.parse(argsForCmd)
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
